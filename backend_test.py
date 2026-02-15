#!/usr/bin/env python3
"""
ISEMS Backend API Testing Suite
Tests all backend endpoints for the Intelligent Solar Energy Management System
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class ISEMSAPITester:
    def __init__(self, base_url: str = None):
        import os
        self.base_url = base_url or os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.timeout = 10

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {test_name}")
        if details:
            print(f"    {details}")
        
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"test": test_name, "details": details})

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, auth_required: bool = True) -> tuple[bool, Dict]:
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
            
            return success, response_data
            
        except Exception as e:
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test health endpoint"""
        success, data = self.make_request('GET', 'health', auth_required=False)
        if success and 'status' in data:
            self.log_result("Health Check", True, f"Status: {data.get('status')}")
        else:
            self.log_result("Health Check", False, f"Response: {data}")

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, data = self.make_request('GET', '', auth_required=False)
        if success and 'message' in data:
            self.log_result("Root Endpoint", True, f"Message: {data.get('message')}")
        else:
            self.log_result("Root Endpoint", False, f"Response: {data}")

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@isems.com"
        user_data = {
            "email": test_email,
            "password": "testpass123",
            "name": "Test User"
        }
        
        success, data = self.make_request('POST', 'auth/register', user_data, 
                                        expected_status=200, auth_required=False)
        
        if success and 'access_token' in data and 'user' in data:
            self.token = data['access_token']
            self.user_id = data['user']['id']
            self.log_result("User Registration", True, f"User ID: {self.user_id}")
        else:
            self.log_result("User Registration", False, f"Response: {data}")

    def test_user_login(self):
        """Test user login with admin credentials"""
        login_data = {
            "email": "admin@isems.com",
            "password": "admin123"
        }
        
        success, data = self.make_request('POST', 'auth/login', login_data, 
                                        expected_status=200, auth_required=False)
        
        if success and 'access_token' in data:
            self.token = data['access_token']
            self.user_id = data['user']['id']
            self.log_result("Admin Login", True, f"Token received, User: {data['user']['name']}")
        else:
            # Try to register admin user if login fails
            admin_data = {
                "email": "admin@isems.com",
                "password": "admin123",
                "name": "Admin User"
            }
            success, data = self.make_request('POST', 'auth/register', admin_data, 
                                            expected_status=200, auth_required=False)
            if success and 'access_token' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                self.log_result("Admin Registration", True, "Admin user created and logged in")
            else:
                self.log_result("Admin Login/Registration", False, f"Response: {data}")

    def test_token_validation(self):
        """Test JWT token validation"""
        if not self.token:
            self.log_result("Token Validation", False, "No token available")
            return
            
        success, data = self.make_request('GET', 'auth/me')
        
        if success and 'email' in data:
            self.log_result("Token Validation", True, f"User: {data.get('email')}")
        else:
            self.log_result("Token Validation", False, f"Response: {data}")

    def test_dashboard_api(self):
        """Test dashboard data API"""
        success, data = self.make_request('GET', 'dashboard')
        
        required_fields = ['solar', 'battery', 'load', 'grid', 'device_online']
        if success and all(field in data for field in required_fields):
            solar_power = data['solar'].get('power', 0)
            battery_soc = data['battery'].get('soc', 0)
            self.log_result("Dashboard API", True, 
                          f"Solar: {solar_power}W, Battery: {battery_soc}%")
        else:
            self.log_result("Dashboard API", False, f"Missing fields or error: {data}")

    def test_dashboard_public(self):
        """Test public dashboard endpoint"""
        success, data = self.make_request('GET', 'dashboard/public', auth_required=False)
        
        if success and 'solar' in data and 'battery' in data:
            self.log_result("Public Dashboard", True, "Public access working")
        else:
            self.log_result("Public Dashboard", False, f"Response: {data}")

    def test_solar_api(self):
        """Test solar data API"""
        success, data = self.make_request('GET', 'solar')
        
        required_fields = ['current', 'history', 'predictions', 'device_online']
        if success and all(field in data for field in required_fields):
            history_count = len(data.get('history', []))
            self.log_result("Solar API", True, f"History records: {history_count}")
        else:
            self.log_result("Solar API", False, f"Response: {data}")

    def test_battery_api(self):
        """Test battery data API"""
        success, data = self.make_request('GET', 'battery')
        
        required_fields = ['current', 'history', 'device_online']
        if success and all(field in data for field in required_fields):
            soc = data['current'].get('soc', 0)
            self.log_result("Battery API", True, f"SOC: {soc}%")
        else:
            self.log_result("Battery API", False, f"Response: {data}")

    def test_load_api(self):
        """Test load data API"""
        success, data = self.make_request('GET', 'load')
        
        required_fields = ['current', 'history', 'device_online']
        if success and all(field in data for field in required_fields):
            power = data['current'].get('power', 0)
            self.log_result("Load API", True, f"Load Power: {power}W")
        else:
            self.log_result("Load API", False, f"Response: {data}")

    def test_load_control(self):
        """Test load control API"""
        # Test light control
        control_data = {"device": "light", "state": True}
        success, data = self.make_request('POST', 'load/control', control_data)
        
        if success and data.get('success'):
            self.log_result("Load Control (Light ON)", True, f"Device: {data.get('device')}")
            
            # Test turning it off
            control_data = {"device": "light", "state": False}
            success, data = self.make_request('POST', 'load/control', control_data)
            if success:
                self.log_result("Load Control (Light OFF)", True, "Light control working")
            else:
                self.log_result("Load Control (Light OFF)", False, f"Response: {data}")
        else:
            self.log_result("Load Control", False, f"Response: {data}")

    def test_grid_api(self):
        """Test grid data API"""
        success, data = self.make_request('GET', 'grid')
        
        required_fields = ['current', 'device_online']
        if success and all(field in data for field in required_fields):
            mode = data['current'].get('mode', 'unknown')
            self.log_result("Grid API", True, f"Mode: {mode}")
        else:
            self.log_result("Grid API", False, f"Response: {data}")

    def test_grid_mode_control(self):
        """Test grid mode setting"""
        success, data = self.make_request('POST', 'grid/mode?mode=solar')
        
        if success and data.get('success'):
            self.log_result("Grid Mode Control", True, f"Mode set to: {data.get('mode')}")
        else:
            self.log_result("Grid Mode Control", False, f"Response: {data}")

    def test_predictions_api(self):
        """Test AI predictions API"""
        success, data = self.make_request('GET', 'predictions')
        
        required_fields = ['linear_regression', 'time_weighted', 'confidence']
        if success and all(field in data for field in required_fields):
            confidence = data.get('confidence', 0) * 100
            self.log_result("AI Predictions", True, f"Confidence: {confidence:.1f}%")
        else:
            self.log_result("AI Predictions", False, f"Response: {data}")

    def test_history_api(self):
        """Test historical data API"""
        success, data = self.make_request('GET', 'history?results=50')
        
        if success and 'data' in data and isinstance(data['data'], list):
            record_count = len(data['data'])
            self.log_result("History API", True, f"Records: {record_count}")
        else:
            self.log_result("History API", False, f"Response: {data}")

    def test_csv_export(self):
        """Test CSV export API"""
        success, data = self.make_request('GET', 'export/csv')
        
        if success and 'csv' in data and 'filename' in data:
            csv_lines = len(data['csv'].split('\n'))
            self.log_result("CSV Export", True, f"CSV lines: {csv_lines}")
        else:
            self.log_result("CSV Export", False, f"Response: {data}")

    def test_websocket_endpoint(self):
        """Test WebSocket endpoint availability (basic check)"""
        try:
            import websocket
            ws_url = self.base_url.replace('https://', 'wss://').replace('http://', 'ws://')
            ws_url = f"{ws_url}/ws"
            
            # Just test if we can connect (don't maintain connection)
            ws = websocket.create_connection(ws_url, timeout=5)
            ws.close()
            self.log_result("WebSocket Endpoint", True, "Connection successful")
        except Exception as e:
            self.log_result("WebSocket Endpoint", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("=" * 60)
        print("🔋 ISEMS Backend API Testing Suite")
        print("=" * 60)
        print(f"Testing against: {self.base_url}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 60)

        # Basic connectivity tests
        print("\n📡 CONNECTIVITY TESTS")
        self.test_health_check()
        self.test_root_endpoint()

        # Authentication tests
        print("\n🔐 AUTHENTICATION TESTS")
        self.test_user_login()  # Try admin login first
        self.test_token_validation()

        # Core API tests
        print("\n📊 CORE API TESTS")
        self.test_dashboard_api()
        self.test_dashboard_public()
        self.test_solar_api()
        self.test_battery_api()
        self.test_load_api()
        self.test_grid_api()

        # Control API tests
        print("\n🎛️ CONTROL API TESTS")
        self.test_load_control()
        self.test_grid_mode_control()

        # Advanced feature tests
        print("\n🧠 ADVANCED FEATURE TESTS")
        self.test_predictions_api()
        self.test_history_api()
        self.test_csv_export()

        # Real-time tests
        print("\n⚡ REAL-TIME TESTS")
        self.test_websocket_endpoint()

        # Summary
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")

        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  • {test['test']}: {test['details']}")

        print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = ISEMSAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n💥 Test suite crashed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())