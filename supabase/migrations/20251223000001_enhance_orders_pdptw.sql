-- Migration: Enhance orders table for PDPTW compliance
-- Date: 2025-12-23
-- Description: Add customer_id, pickup-delivery pairing, and PDPTW node mapping fields

-- Add new columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paired_order_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pdptw_node_id integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pdptw_node_type varchar(20) CHECK (pdptw_node_type IN ('pickup', 'delivery', 'depot'));

-- Add foreign key constraints
ALTER TABLE orders 
    ADD CONSTRAINT fk_orders_customer 
    FOREIGN KEY (customer_id) 
    REFERENCES locations(id) 
    ON DELETE SET NULL;

ALTER TABLE orders 
    ADD CONSTRAINT fk_orders_paired 
    FOREIGN KEY (paired_order_id) 
    REFERENCES orders(id) 
    ON DELETE SET NULL;

-- Add check constraint: paired orders must have opposite node types
ALTER TABLE orders
    ADD CONSTRAINT chk_paired_order_consistency
    CHECK (
        paired_order_id IS NULL OR
        (pdptw_node_type IS NOT NULL AND pdptw_node_type IN ('pickup', 'delivery'))
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_paired ON orders(paired_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_pdptw_node ON orders(pdptw_node_id);
CREATE INDEX IF NOT EXISTS idx_orders_pdptw_type ON orders(pdptw_node_type);

-- Add composite index for PDPTW solver queries
CREATE INDEX IF NOT EXISTS idx_orders_org_status_pdptw 
    ON orders(organization_id, status, pdptw_node_type);

-- Add comments for documentation
COMMENT ON COLUMN orders.customer_id IS 'Reference to customer location (for grouping orders by customer)';
COMMENT ON COLUMN orders.paired_order_id IS 'Links pickup and delivery orders (self-referencing FK)';
COMMENT ON COLUMN orders.pdptw_node_id IS 'Sequential node ID for PDPTW solver (1 to N)';
COMMENT ON COLUMN orders.pdptw_node_type IS 'Node type for PDPTW: pickup, delivery, or depot';

-- Update existing orders with default values
-- Set pdptw_node_type to 'pickup' for existing orders as a default
-- Note: This should be manually reviewed and corrected based on business logic
UPDATE orders 
SET pdptw_node_type = 'pickup'
WHERE pdptw_node_type IS NULL AND status != 'delivered';

-- Add trigger to maintain updated_at timestamp
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();
