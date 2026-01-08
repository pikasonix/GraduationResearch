-- Migration: Auto-create pickup/delivery locations for shipment-style orders
-- Date: 2025-12-24
-- Description: Ensure orders can be inserted without manually managing pickup_location_id / delivery_location_id

CREATE OR REPLACE FUNCTION public.ensure_order_locations()
RETURNS TRIGGER AS $$
DECLARE
    pickup_loc_id uuid;
    delivery_loc_id uuid;
BEGIN
    -- Create pickup location if missing
    IF NEW.pickup_location_id IS NULL THEN
        INSERT INTO public.locations (
            organization_id,
            location_type,
            name,
            address,
            latitude,
            longitude,
            contact_name,
            contact_phone,
            notes
        ) VALUES (
            NEW.organization_id,
            'pickup_point',
            COALESCE(NULLIF(NEW.pickup_contact_name, ''), 'Pickup'),
            NEW.pickup_address,
            NEW.pickup_latitude,
            NEW.pickup_longitude,
            NULLIF(NEW.pickup_contact_name, ''),
            NULLIF(NEW.pickup_contact_phone, ''),
            NEW.pickup_notes
        )
        RETURNING id INTO pickup_loc_id;

        NEW.pickup_location_id := pickup_loc_id;
    END IF;

    -- Create delivery location if missing
    IF NEW.delivery_location_id IS NULL THEN
        INSERT INTO public.locations (
            organization_id,
            location_type,
            name,
            address,
            latitude,
            longitude,
            contact_name,
            contact_phone,
            notes
        ) VALUES (
            NEW.organization_id,
            'delivery_point',
            COALESCE(NULLIF(NEW.delivery_contact_name, ''), 'Delivery'),
            NEW.delivery_address,
            NEW.delivery_latitude,
            NEW.delivery_longitude,
            NULLIF(NEW.delivery_contact_name, ''),
            NULLIF(NEW.delivery_contact_phone, ''),
            NEW.delivery_notes
        )
        RETURNING id INTO delivery_loc_id;

        NEW.delivery_location_id := delivery_loc_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_order_locations ON public.orders;
CREATE TRIGGER ensure_order_locations
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_order_locations();
