import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

type LocationType = "warehouse" | "customer" | "pickup_point" | "delivery_point";

type LocationInsert = {
    organization_id: string;
    location_type: LocationType;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    contact_name?: string;
    contact_phone?: string;
    notes?: string;
};

// Types matching schema
export type OrderStatus =
    | "pending"
    | "assigned"
    | "in_transit"
    | "picked_up"
    | "delivered"
    | "failed"
    | "cancelled";

export type PriorityLevel = "normal" | "urgent";

export interface Order {
    id: string;
    organization_id: string;
    tracking_number: string;
    reference_code?: string;
    product_name?: string;
    product_value?: number;
    weight?: number;
    volume?: number;

    // Pickup info
    pickup_location_id: string;
    pickup_contact_name: string;
    pickup_contact_phone: string;
    pickup_address: string;
    pickup_latitude: number;
    pickup_longitude: number;
    pickup_time_start?: string;
    pickup_time_end?: string;
    pickup_notes?: string;

    // Delivery info
    delivery_location_id: string;
    delivery_contact_name: string;
    delivery_contact_phone: string;
    delivery_address: string;
    delivery_latitude: number;
    delivery_longitude: number;
    delivery_time_start?: string;
    delivery_time_end?: string;
    delivery_notes?: string;

    priority: PriorityLevel;
    service_time_pickup: number; // minutes
    service_time_delivery: number; // minutes
    status: OrderStatus;

    // PDPTW fields
    customer_id?: string;
    paired_order_id?: string;
    pdptw_node_id?: number;
    pdptw_node_type?: 'pickup' | 'delivery' | 'depot';

    // Timestamps
    created_at: string;
    updated_at: string;
    assigned_at?: string;
    picked_up_at?: string;
    delivered_at?: string;

    // Metadata
    internal_notes?: string;
    cancellation_reason?: string;
}

function getOrderString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    return undefined;
}

function getOrderNumber(value: unknown): number | undefined {
    if (typeof value === "number" && !Number.isNaN(value)) return value;
    return undefined;
}

async function createLocationForOrderSide(order: Partial<Order>, side: "pickup" | "delivery"): Promise<string> {
    const organizationId = getOrderString(order.organization_id);
    if (!organizationId) throw new Error("Missing organization_id for location creation");

    const isPickup = side === "pickup";
    const address = getOrderString(isPickup ? order.pickup_address : order.delivery_address);
    const latitude = getOrderNumber(isPickup ? order.pickup_latitude : order.delivery_latitude);
    const longitude = getOrderNumber(isPickup ? order.pickup_longitude : order.delivery_longitude);

    if (!address || latitude === undefined || longitude === undefined) {
        throw new Error(`Missing ${side} address/latitude/longitude for location creation`);
    }

    const contactName = getOrderString(isPickup ? order.pickup_contact_name : order.delivery_contact_name);
    const contactPhone = getOrderString(isPickup ? order.pickup_contact_phone : order.delivery_contact_phone);
    const notes = getOrderString(isPickup ? order.pickup_notes : order.delivery_notes);

    const payload: LocationInsert = {
        organization_id: organizationId,
        location_type: isPickup ? "pickup_point" : "delivery_point",
        name: contactName?.trim() || (isPickup ? "Pickup" : "Delivery"),
        address,
        latitude,
        longitude,
        contact_name: contactName,
        contact_phone: contactPhone,
        notes,
    };

    const { data, error } = await supabase
        .from("locations")
        .insert(payload)
        .select("id")
        .single();

    if (error) throw error;
    return data.id as string;
}

async function updateLocationFromOrderSide(order: Partial<Order>, side: "pickup" | "delivery"): Promise<void> {
    const isPickup = side === "pickup";
    const locationId = getOrderString(isPickup ? order.pickup_location_id : order.delivery_location_id);
    if (!locationId) return;

    const address = getOrderString(isPickup ? order.pickup_address : order.delivery_address);
    const latitude = getOrderNumber(isPickup ? order.pickup_latitude : order.delivery_latitude);
    const longitude = getOrderNumber(isPickup ? order.pickup_longitude : order.delivery_longitude);
    const contactName = getOrderString(isPickup ? order.pickup_contact_name : order.delivery_contact_name);
    const contactPhone = getOrderString(isPickup ? order.pickup_contact_phone : order.delivery_contact_phone);
    const notes = getOrderString(isPickup ? order.pickup_notes : order.delivery_notes);

    const updates: Partial<LocationInsert> & { name?: string } = {};
    if (address !== undefined) updates.address = address;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (contactName !== undefined) {
        updates.contact_name = contactName;
        updates.name = contactName.trim() || (isPickup ? "Pickup" : "Delivery");
    }
    if (contactPhone !== undefined) updates.contact_phone = contactPhone;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
        .from("locations")
        .update(updates)
        .eq("id", locationId);

    if (error) throw error;
}

// Format Supabase errors for RTK Query
function formatSupabaseError(error: PostgrestError): FetchBaseQueryError {
    return {
        status: "CUSTOM_ERROR",
        error: error.message,
        data: error.details,
    };
}

export const orderApi = createApi({
    reducerPath: "orderApi",
    baseQuery: fetchBaseQuery({ baseUrl: "/" }),
    tagTypes: ["Order"],
    endpoints: (builder) => ({
        getOrders: builder.query<Order[], { organizationId: string; status?: OrderStatus | "all"; search?: string; limit?: number }>({
            queryFn: async ({ organizationId, status, search, limit = 50 }) => {
                let query = supabase
                    .from("orders")
                    .select("*")
                    .eq("organization_id", organizationId)
                    .order("created_at", { ascending: false });

                if (status && status !== "all") {
                    query = query.eq("status", status);
                }

                if (search) {
                    query = query.or(`tracking_number.ilike.%${search}%,reference_code.ilike.%${search}%,pickup_contact_name.ilike.%${search}%,delivery_contact_name.ilike.%${search}%`);
                }

                if (limit) {
                    query = query.limit(limit);
                }

                const { data, error } = await query;

                if (error) return { error: formatSupabaseError(error) };
                return { data: data as Order[] };
            },
            providesTags: (result) =>
                result
                    ? [
                        ...result.map(({ id }) => ({ type: "Order" as const, id })),
                        { type: "Order", id: "LIST" },
                    ]
                    : [{ type: "Order", id: "LIST" }],
        }),

        getOrder: builder.query<Order, string>({
            queryFn: async (id) => {
                const { data, error } = await supabase
                    .from("orders")
                    .select("*")
                    .eq("id", id)
                    .single();

                if (error) return { error: formatSupabaseError(error) };
                return { data: data as Order };
            },
            providesTags: (result, error, id) => [{ type: "Order", id }],
        }),

        createOrder: builder.mutation<Order, Partial<Order>>({
            queryFn: async (newOrder) => {
                try {
                    const orderToInsert: Partial<Order> = { ...newOrder };

                    // Treat an order as a "shipment" record. Ensure we have normalized locations
                    // because the DB schema requires pickup_location_id and delivery_location_id.
                    if (!orderToInsert.pickup_location_id) {
                        orderToInsert.pickup_location_id = await createLocationForOrderSide(orderToInsert, "pickup");
                    }

                    if (!orderToInsert.delivery_location_id) {
                        orderToInsert.delivery_location_id = await createLocationForOrderSide(orderToInsert, "delivery");
                    }

                    const { data, error } = await supabase
                        .from("orders")
                        .insert(orderToInsert)
                        .select()
                        .single();

                    if (error) return { error: formatSupabaseError(error) };
                    return { data: data as Order };
                } catch (e: any) {
                    const message = e?.message || "Failed to create order";
                    return { error: { status: "CUSTOM_ERROR", error: message, data: null } };
                }
            },
            invalidatesTags: [{ type: "Order", id: "LIST" }],
        }),

        updateOrder: builder.mutation<Order, { id: string } & Partial<Order>>({
            queryFn: async ({ id, ...updates }) => {
                try {
                    // Keep locations in sync when users edit pickup/delivery details.
                    await updateLocationFromOrderSide(updates, "pickup");
                    await updateLocationFromOrderSide(updates, "delivery");

                    const { data, error } = await supabase
                        .from("orders")
                        .update(updates)
                        .eq("id", id)
                        .select()
                        .single();

                    if (error) return { error: formatSupabaseError(error) };
                    return { data: data as Order };
                } catch (e: any) {
                    const message = e?.message || "Failed to update order";
                    return { error: { status: "CUSTOM_ERROR", error: message, data: null } };
                }
            },
            invalidatesTags: (result, error, { id }) => [
                { type: "Order", id },
                { type: "Order", id: "LIST" },
            ],
        }),

        deleteOrder: builder.mutation<void, string>({
            queryFn: async (id) => {
                // Check if order is assigned to any routes
                const { data: routeStops, error: checkError } = await supabase
                    .from('route_stops')
                    .select('id')
                    .eq('order_id', id)
                    .limit(1);

                if (checkError) {
                    return { error: formatSupabaseError(checkError) };
                }

                if (routeStops && routeStops.length > 0) {
                    return {
                        error: {
                            status: 'CUSTOM_ERROR',
                            error: 'Cannot delete order that is assigned to a route. Please remove it from the route first.',
                            data: null,
                        },
                    };
                }

                const { error } = await supabase
                    .from("orders")
                    .delete()
                    .eq("id", id);

                if (error) return { error: formatSupabaseError(error) };
                return { data: undefined };
            },
            invalidatesTags: [{ type: "Order", id: "LIST" }],
        }),
    }),
});

export const {
    useGetOrdersQuery,
    useGetOrderQuery,
    useCreateOrderMutation,
    useUpdateOrderMutation,
    useDeleteOrderMutation,
} = orderApi;
