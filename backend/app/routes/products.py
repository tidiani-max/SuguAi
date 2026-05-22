"""
app/routes/products.py
───────────────────────
Products CRUD + variant management endpoints.

Stock sync rule:
  - When a product has variants, product.stock is auto-updated to sum(variant.stock).
  - When a product has no variants, product.stock is set directly.

New endpoints:
  POST   /products/{id}/variants          — add a variant
  PATCH  /products/{id}/variants/{vid}    — update a variant
  DELETE /products/{id}/variants/{vid}    — delete a variant (hard delete)
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
import uuid, os, shutil

from app.database import get_db
from app.models.product import Product, ProductVariant
from app.models.business import Business
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse,
    VariantCreate, VariantUpdate, VariantResponse,
)
from app.dependencies import get_current_business

router = APIRouter(prefix="/products", tags=["Products"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _sync_stock(product: Product) -> None:
    """Recompute product.stock = sum of active variant stocks."""
    active = [v for v in product.variants if v.is_active]
    if active:
        product.stock = sum(v.stock for v in active)


async def _load_product(
    product_id: uuid.UUID,
    business_id: uuid.UUID,
    db: AsyncSession,
) -> Product:
    """Load product with variants, scoped to business. Raises 404 if not found."""
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.business_id == business_id)
        .options(selectinload(Product.variants))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


# ── Image upload ──────────────────────────────────────────────────────────────

@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    business: Business = Depends(get_current_business),
):
    """Upload a product or variant image and return its public URL."""
    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    filename = f"{uuid.uuid4()}.{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    try:
        with open(dest, "wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to save file")

    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    return {"url": f"{base_url}/uploads/{filename}"}


# ── Products CRUD ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ProductResponse])
async def list_products(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
    select(Product)
    .where(Product.business_id == business.id, Product.is_active == True)
    .options(selectinload(Product.variants))
    .order_by(Product.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    variants_data = data.variants or []
    product_data  = data.model_dump(exclude={"variants"})

    product = Product(business_id=business.id, **product_data)
    db.add(product)
    await db.flush()   # get product.id

    for i, v in enumerate(variants_data):
        variant = ProductVariant(
            product_id=product.id,
            sort_order=v.sort_order if v.sort_order else i,
            **v.model_dump(exclude={"sort_order"}),
        )
        db.add(variant)

    await db.flush()

    # Reload with variants to sync stock
    await db.refresh(product)
    result = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.variants))
    )
    product = result.scalar_one()
    _sync_stock(product)
    await db.flush()

    return ProductResponse.model_validate(product)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    return await _load_product(product_id, business.id, db)


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    product = await _load_product(product_id, business.id, db)

    # Update scalar fields
    scalar_fields = data.model_dump(exclude={"variants"}, exclude_none=True)
    for field, value in scalar_fields.items():
        setattr(product, field, value)

    # Full variant replacement when variants list is explicitly provided
    if data.variants is not None:
        # Delete existing variants
        for v in list(product.variants):
            await db.delete(v)
        await db.flush()
        product.variants.clear()

        # Insert new variants
        for i, v in enumerate(data.variants):
            variant = ProductVariant(
                product_id=product.id,
                sort_order=v.sort_order if v.sort_order else i,
                **v.model_dump(exclude={"sort_order"}),
            )
            db.add(variant)

        await db.flush()

        # Reload variants for stock sync
        result = await db.execute(
            select(Product)
            .where(Product.id == product.id)
            .options(selectinload(Product.variants))
        )
        product = result.scalar_one()

    _sync_stock(product)
    await db.flush()
    await db.refresh(product)

    result = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.variants))
    )
    return ProductResponse.model_validate(result.scalar_one())


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    product = await _load_product(product_id, business.id, db)
    product.is_active = False
    await db.flush()


# ── Variant endpoints ──────────────────────────────────────────────────────────

@router.post(
    "/{product_id}/variants",
    response_model=VariantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_variant(
    product_id: uuid.UUID,
    data: VariantCreate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Add a single variant to an existing product."""
    product = await _load_product(product_id, business.id, db)

    # Auto sort_order: append after existing
    max_order = max((v.sort_order for v in product.variants), default=-1)
    variant = ProductVariant(
        product_id=product.id,
        sort_order=data.sort_order if data.sort_order else max_order + 1,
        **data.model_dump(exclude={"sort_order"}),
    )
    db.add(variant)
    await db.flush()

    # Reload product to sync stock
    result = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.variants))
    )
    product = result.scalar_one()
    _sync_stock(product)
    await db.flush()
    await db.refresh(variant)

    return VariantResponse.model_validate(variant)


@router.patch(
    "/{product_id}/variants/{variant_id}",
    response_model=VariantResponse,
)
async def update_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    data: VariantUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Update a specific variant (name, image, stock, color…)."""
    product = await _load_product(product_id, business.id, db)

    variant = next((v for v in product.variants if v.id == variant_id), None)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(variant, field, value)

    await db.flush()
    _sync_stock(product)
    await db.flush()
    await db.refresh(variant)

    return VariantResponse.model_validate(variant)


@router.delete(
    "/{product_id}/variants/{variant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete a variant and resync product stock."""
    product = await _load_product(product_id, business.id, db)

    variant = next((v for v in product.variants if v.id == variant_id), None)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    await db.delete(variant)
    await db.flush()

    # Reload to resync stock
    result = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.variants))
    )
    product = result.scalar_one()
    _sync_stock(product)
    await db.flush()