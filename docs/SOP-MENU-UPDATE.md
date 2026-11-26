# SOP: Update the In-Room Dining Menu

## Source of truth

The guest app loads the published `Menu_POS_Export` CSV from the MANA Master Database. It uses `data/menu-data.js` only when the live sheet cannot be loaded. Keep menu codes stable so that photos and existing references continue to match.

## Update menu details

1. Edit the appropriate menu row in the MANA Master Database; verify the item name, English name, price, category, and status.
2. Set the status to `พร้อมขาย` to show the item in the guest app. Check that unavailable items are not marked for sale.
3. Confirm the published CSV for the configured sheet is accessible and reflects the changes.
4. Open the ordering app and check the item, price, category, and Thai/English/Chinese labels. Confirm that the live sheet is being used rather than the offline snapshot.

## Update menu photos

Use the staff photo editor in the app to crop and upload photos. The editor requires the Apps Script `ImageUpload.gs` handler and valid `DEV_USER` / `DEV_PASS` script properties. Confirm the new image is visible after upload.

## Verify before release

1. Check the affected item on desktop and a mobile-sized screen.
2. Test checkout content without placing an unintended live order.
3. Verify that menu availability and prices are correct in the published site.
4. If the live CSV or photo service fails, report the issue and restore the service; do not silently make an unreviewed offline snapshot the new source of truth.

## FoodStory exports

The optional FoodStory scraper and its tests are under `tools/foodstory-scrape/`. Its scheduled GitHub Actions workflow is at `.github/workflows/scrape_foodstory_modal.yml`. Configure `FOODSTORY_USERNAME` and `FOODSTORY_PASSWORD` as repository Actions secrets; do not put account credentials in source files.
