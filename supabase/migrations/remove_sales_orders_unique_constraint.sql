-- Remove unique constraint from sales_orders to allow multiple uploads per day
-- This allows the same item to be uploaded multiple times on the same day
-- The get_latest_price function will always return the most recent price

-- Drop the unique constraint if it exists
ALTER TABLE sales_orders 
  DROP CONSTRAINT IF EXISTS sales_orders_item_number_uploaded_at_key;
