import { supabase } from '@/supabase/client';
import type { Station } from './StationPinTool';

export class StationService {
    /**
     * Lưu trạm mới vào Supabase
     */
    static async saveStation(station: Omit<Station, 'id'>): Promise<Station> {
        const { data, error } = await supabase
            .from('stations')
            .insert({
                name: station.name,
                type: station.type,
                lat: station.lat,
                lng: station.lng,
                description: station.description,
                contact: station.contact,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Không thể lưu trạm: ${error.message}`);
        }

        return data;
    }

    /**
     * Lấy tất cả các trạm
     */
    static async getAllStations(): Promise<Station[]> {
        const { data, error } = await supabase
            .from('stations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Không thể lấy danh sách trạm: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Lấy các trạm theo loại
     */
    static async getStationsByType(type: string): Promise<Station[]> {
        const { data, error } = await supabase
            .from('stations')
            .select('*')
            .eq('type', type)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Không thể lấy trạm theo loại: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Lấy các trạm trong khu vực (theo bounding box)
     */
    static async getStationsInBounds(bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    }): Promise<Station[]> {
        const { data, error } = await supabase
            .from('stations')
            .select('*')
            .gte('lat', bounds.south)
            .lte('lat', bounds.north)
            .gte('lng', bounds.west)
            .lte('lng', bounds.east);

        if (error) {
            throw new Error(`Không thể lấy trạm trong khu vực: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Cập nhật thông tin trạm
     */
    static async updateStation(id: string, updates: Partial<Station>): Promise<Station> {
        const { data, error } = await supabase
            .from('stations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Không thể cập nhật trạm: ${error.message}`);
        }

        return data;
    }

    /**
     * Xóa trạm
     */
    static async deleteStation(id: string): Promise<void> {
        const { error } = await supabase
            .from('stations')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Không thể xóa trạm: ${error.message}`);
        }
    }

    /**
     * Tìm trạm gần nhất
     */
    static async findNearestStations(
        lat: number,
        lng: number,
        type?: string,
        limit: number = 5
    ): Promise<Station[]> {
        let query = supabase
            .from('stations')
            .select('*');

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query.limit(limit);

        if (error) {
            throw new Error(`Không thể tìm trạm gần nhất: ${error.message}`);
        }

        if (!data) return [];

        // Tính khoảng cách và sắp xếp
        const stationsWithDistance = data.map(station => ({
            ...station,
            distance: this.calculateDistance(lat, lng, station.lat, station.lng)
        }));

        return stationsWithDistance
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);
    }

    /**
     * Tính khoảng cách giữa 2 điểm (haversine formula)
     */
    private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Bán kính Trái Đất (km)
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private static toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}