"""
Unit Tests for FoodStory Menu Scraper
Tests all core functions of the scraper module
"""

import unittest
from pathlib import Path
import json
import tempfile
from unittest import mock

import scripts.scrape_foodstory_modal as scraper_module
from scripts.scrape_foodstory_modal import FoodStoryScraper, main


class TestFoodStoryScraper(unittest.TestCase):
    """Test cases for FoodStoryScraper class"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.project_root = Path(self.temp_dir.name)
        (self.project_root / "data").mkdir()
        self.test_mapping_file = self.project_root / "data" / "menu_zh_mapping.json"
        self.test_mapping_file.write_text(json.dumps({
            "by_code": {
                "M001": "เมนูอาหารจานแรก",
                "M002": "เมนูอาหารจานที่สอง"
            },
            "by_english": {
                "Spicy Chicken Curry": "ไก่สับปะรดเผ็ด",
                "Pad Thai": "ผัดไทย"
            },
            "by_thai": {
                "ไก่ทอด": "ไก่ทอด",
                "ข้าวผัด": "ข้าวผัด"
            }
        }, ensure_ascii=False), encoding="utf-8")
        project_root = mock.patch.object(scraper_module, "PROJECT_ROOT", self.project_root)
        project_root.start()
        self.addCleanup(project_root.stop)

    def test_get_chinese_name_by_code(self):
        """Test getting Chinese name by menu code"""
        scraper = FoodStoryScraper(username="test@example.com", password="test_password")
        mock_details = {'thai_name': '', 'english_name': ''}
        self.assertEqual(scraper._get_chinese_name('M001', mock_details), "เมนูอาหารจานแรก")

    def test_get_chinese_name_by_english(self):
        """Test getting Chinese name by English name"""
        scraper = FoodStoryScraper(username="test@example.com", password="test_password")
        mock_details = {'thai_name': '', 'english_name': 'Spicy Chicken Curry'}
        self.assertEqual(scraper._get_chinese_name('M999', mock_details), "ไก่สับปะรดเผ็ด")

    def test_get_chinese_name_by_thai(self):
        """Test getting Chinese name by Thai name"""
        scraper = FoodStoryScraper(username="test@example.com", password="test_password")
        mock_details = {'thai_name': 'ไก่ทอด', 'english_name': ''}
        self.assertEqual(scraper._get_chinese_name('M003', mock_details), "ไก่ทอด")

    def test_get_chinese_name_not_found(self):
        """Test getting Chinese name when not found in mapping"""
        scraper = FoodStoryScraper(username="test@example.com", password="test_password")
        mock_details = {'thai_name': '', 'english_name': ''}
        self.assertEqual(scraper._get_chinese_name('M999', mock_details), "")

    def test_mapping_file_structure(self):
        data = json.loads(self.test_mapping_file.read_text(encoding="utf-8"))
        self.assertIn('by_code', data)
        self.assertIn('by_english', data)
        self.assertIn('by_thai', data)


class TestMainFunction(unittest.TestCase):
    """Test cases for main function"""

    def test_main_function_exists(self):
        """Test that main function exists and is callable"""
        # ตรวจสอบว่าฟังก์ชัน main มีอยู่และสามารถเรียกได้
        self.assertTrue(callable(main), "main function should be callable")


if __name__ == '__main__':
    # รันทดสอบทั้งหมด
    unittest.main(verbosity=2)