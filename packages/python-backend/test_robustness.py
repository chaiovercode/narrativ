
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add package root to path
sys.path.append(os.getcwd())

class TestNarrativRobustness(unittest.TestCase):

    def setUp(self):
        # Reset clients before each test
        if 'services.clients' in sys.modules:
            import services.clients
            services.clients.gemini_client = None
            services.clients.str = None
    
    def test_dynamic_client_loading_image(self):
        """Test that image service uses the latest client object, not a stale one."""
        
        # 1. Start with no client
        import services.clients
        services.clients.gemini_client = None
        
        from services.image import _generate_with_gemini
        
        # 2. Update client "dynamically" (simulating reload_clients)
        mock_client = MagicMock()
        services.clients.gemini_client = mock_client
        
        # 3. Call the function - it should use the NEW mock_client, not None
        # We expect it to fail further down because we didn't mock everything, 
        # but NOT because client is missing.
        
        try:
            _generate_with_gemini("test prompt", "square")
        except Exception as e:
            # If it says "Gemini client not initialized", the test FAILED
            if "Gemini client not initialized" in str(e):
                self.fail("Image service failed to see updated gemini_client!")
            # Other errors are expected as we aren't mocking the full API call
            pass
            
    def test_dynamic_client_loading_llm(self):
        """Test that LLM service uses the latest client object."""
        
        # 1. Start with no client
        import services.clients
        services.clients.gemini_client = None
        
        from services.llm import _generate_with_gemini
        
        # 2. Update client
        mock_client = MagicMock()
        services.clients.gemini_client = mock_client
        
        # 3. Call function
        try:
            _generate_with_gemini("test prompt")
        except Exception as e:
            if "Gemini client not available" in str(e):
                self.fail("LLM service failed to see updated gemini_client!")
            pass

if __name__ == '__main__':
    unittest.main()
