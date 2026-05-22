import requests
import json

# --- CONFIGURATION ---
EVOLUTION_BASE = "http://localhost:8080"
# Ensure this matches the AUTHENTICATION_API_KEY in your Evolution Docker/Env
EVOLUTION_API_KEY = "evolution-secret-key-2024"
INSTANCE_NAME = "biz-aaa384bf" 

# IMPORTANT: Include Country Code without '+' (e.g., 223 for Mali)
# If 77610814058 failed, try "22377610814058"
TARGET_PHONE = "22377610814058" 

def test_send():
    # The endpoint remains the same, but the JSON structure is nested
    url = f"{EVOLUTION_BASE}/message/sendText/{INSTANCE_NAME}"
    
    headers = {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    
    # This is the 'textMessage' structure the API now requires
    payload = {
        "number": TARGET_PHONE,
        "textMessage": {
            "text": "Hello! Test from terminal. Payload format and API Key are now correct. ✅"
        }
    }

    print(f"--- WHATSAPP TEST ---")
    print(f"Target Instance: {INSTANCE_NAME}")
    print(f"Target Number:   {TARGET_PHONE}")
    print(f"URL:             {url}")
    print(f"----------------------")
    
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=10)
        
        print(f"Status Code: {resp.status_code}")
        print(f"Response:    {resp.text}")
        
        if resp.status_code in (200, 201):
            print("\n✅ SUCCESS! The message was accepted by Evolution API.")
            print("Check the WhatsApp phone linked to the instance.")
        elif resp.status_code == 400:
            print("\n❌ FAILED: 400 Bad Request.")
            print("Check if the number is correct (must include country code).")
        elif resp.status_code == 401:
            print("\n❌ FAILED: 401 Unauthorized.")
            print("Check if EVOLUTION_API_KEY is correct.")
        else:
            print(f"\n❌ FAILED: Received unexpected status {resp.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to Evolution API.")
        print(f"Is the server running at {EVOLUTION_BASE}?")
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")

if __name__ == "__main__":
    test_send()