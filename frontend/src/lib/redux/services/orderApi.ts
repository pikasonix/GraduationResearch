import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

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
                const { data, error } = await supabase
                    .from("orders")
                    .insert(newOrder)
                    .select()
                    .single();

                if (error) return { error: formatSupabaseError(error) };
                return { data: data as Order };
            },
            invalidatesTags: [{ type: "Order", id: "LIST" }],
        }),

        updateOrder: builder.mutation<Order, { id: string } & Partial<Order>>({
            queryFn: async ({ id, ...updates }) => {
                const { data, error } = await supabase
                    .from("orders")
                    .update(updates)
                    .eq("id", id)
                    .select()
                    .single();

                if (error) return { error: formatSupabaseError(error) };
                return { data: data as Order };
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
