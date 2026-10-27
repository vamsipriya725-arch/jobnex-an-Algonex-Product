"""
test_llm_agent_scenarios.py
Validates the 6 required scenarios against the live FastAPI /api/chat route.
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.testclient import TestClient
from chatbot_assistant import create_router

app = FastAPI()
app.include_router(create_router())
client = TestClient(app)

def run_tests():
    print("=" * 70)
    print("JOBNEX AI CAREER AGENT - STEP 6 VERIFICATION TEST SUITE")
    print("=" * 70)
    
    session_id = "test_llm_session_user"
    
    # Test 1: "do you know Algonex"
    print("\n[TEST 1] Query: 'do you know Algonex'")
    r1 = client.post("/api/chat", json={"message": "do you know Algonex", "session_id": session_id})
    assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
    data1 = r1.json()
    print("Output:\n" + data1["reply"])
    print("-" * 50)
    print("Follow-up chips:", data1.get("quick_replies", []))
    
    # Test 2: "Find Python developer jobs"
    print("\n[TEST 2] Query: 'Find Python developer jobs'")
    r2 = client.post("/api/chat", json={"message": "Find Python developer jobs", "session_id": session_id})
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}"
    data2 = r2.json()
    print("Output:\n" + data2["reply"])
    print("-" * 50)
    print("Follow-up chips:", data2.get("quick_replies", []))
    
    # Test 3: "Courses for Docker and SQL"
    print("\n[TEST 3] Query: 'Courses for Docker and SQL'")
    r3 = client.post("/api/chat", json={"message": "Courses for Docker and SQL", "session_id": session_id})
    assert r3.status_code == 200, f"Expected 200, got {r3.status_code}"
    data3 = r3.json()
    print("Output:\n" + data3["reply"])
    print("-" * 50)
    print("Follow-up chips:", data3.get("quick_replies", []))
    
    # Test 4: "How do I analyze my resume?"
    print("\n[TEST 4] Query: 'How do I analyze my resume?'")
    r4 = client.post("/api/chat", json={"message": "How do I analyze my resume?", "session_id": session_id})
    assert r4.status_code == 200, f"Expected 200, got {r4.status_code}"
    data4 = r4.json()
    print("Output:\n" + data4["reply"])
    print("-" * 50)
    print("Follow-up chips:", data4.get("quick_replies", []))
    
    # Test 5: Follow-up question that depends on previous answer
    print("\n[TEST 5] Query (Follow-up): 'Can you give me interview practice questions for the roles you mentioned?'")
    r5 = client.post("/api/chat", json={"message": "Can you give me interview practice questions for the roles you mentioned?", "session_id": session_id})
    assert r5.status_code == 200, f"Expected 200, got {r5.status_code}"
    data5 = r5.json()
    print("Output:\n" + data5["reply"])
    print("-" * 50)
    print("Follow-up chips:", data5.get("quick_replies", []))

    # Test 6: Off-topic question
    print("\n[TEST 6] Query (Off-topic): 'How do I bake chocolate chip cookies?'")
    r6 = client.post("/api/chat", json={"message": "How do I bake chocolate chip cookies?", "session_id": session_id})
    assert r6.status_code == 200, f"Expected 200, got {r6.status_code}"
    data6 = r6.json()
    print("Output:\n" + data6["reply"])
    print("-" * 50)
    print("Follow-up chips:", data6.get("quick_replies", []))

    # Test 7: Reset conversation
    print("\n[TEST 7] Reset / DELETE /api/chat/{session_id}")
    r7 = client.delete(f"/api/chat/{session_id}")
    assert r7.status_code == 200, f"Expected 200, got {r7.status_code}"
    print("Reset response:", r7.json())
    print("\n" + "=" * 70)
    print("ALL 6 TEST SCENARIOS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
