-- Migration to update priority_level enum to only have 'normal' and 'urgent'
-- Step 1: Update all existing orders to use the new priority values
UPDATE public.orders
SET priority = CASE
    WHEN priority IN ('low', 'normal') THEN 'normal'
    WHEN priority IN ('high', 'urgent') THEN 'urgent'
    ELSE 'normal'
END;

-- Step 2: Create new enum type with only two values
CREATE TYPE public.priority_level_new AS ENUM ('normal', 'urgent');

-- Step 3: Alter the orders table to use the new enum type
ALTER TABLE public.orders 
    ALTER COLUMN priority TYPE public.priority_level_new 
    USING (
        CASE 
            WHEN priority::text IN ('low', 'normal') THEN 'normal'::public.priority_level_new
            WHEN priority::text IN ('high', 'urgent') THEN 'urgent'::public.priority_level_new
            ELSE 'normal'::public.priority_level_new
        END
    );

-- Step 4: Drop the old enum type
DROP TYPE public.priority_level;

-- Step 5: Rename the new type to the original name
ALTER TYPE public.priority_level_new RENAME TO priority_level;

-- Update default value
ALTER TABLE public.orders 
    ALTER COLUMN priority SET DEFAULT 'normal'::public.priority_level;
