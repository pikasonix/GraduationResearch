/**
 * Seed Orders Data Script
 * Run: npx tsx scripts/seed-orders.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Hanoi districts and sample addresses
const hanoiLocations = [
    { district: 'Ba Đình', lat: 21.0342, lng: 105.8226, addresses: ['Nguyễn Thái Học', 'Hoàng Diệu', 'Đội Cấn', 'Kim Mã'] },
    { district: 'Hoàn Kiếm', lat: 21.0285, lng: 105.8542, addresses: ['Hàng Bài', 'Tràng Tiền', 'Lý Thái Tổ', 'Đinh Tiên Hoàng'] },
    { district: 'Hai Bà Trưng', lat: 21.0147, lng: 105.8467, addresses: ['Bà Triệu', 'Trần Đại Nghĩa', 'Minh Khai', 'Lê Duẩn'] },
    { district: 'Đống Đa', lat: 21.0278, lng: 105.8270, addresses: ['Láng Hạ', 'Xã Đàn', 'Nguyễn Lương Bằng', 'Tôn Thất Tùng'] },
    { district: 'Tây Hồ', lat: 21.0752, lng: 105.8192, addresses: ['Xuân Diệu', 'Yên Phụ', 'Quảng An', 'Thụy Khuê'] },
    { district: 'Cầu Giấy', lat: 21.0333, lng: 105.7943, addresses: ['Xuân Thủy', 'Trần Thái Tông', 'Duy Tân', 'Phạm Văn Đồng'] },
    { district: 'Thanh Xuân', lat: 20.9950, lng: 105.8050, addresses: ['Nguyễn Trãi', 'Khuất Duy Tiến', 'Kim Giang', 'Hạ Đình'] },
    { district: 'Long Biên', lat: 21.0453, lng: 105.8905, addresses: ['Ngô Gia Tự', 'Nguyễn Văn Cừ', 'Phúc Lợi', 'Gia Thụy'] },
    { district: 'Hoàng Mai', lat: 20.9746, lng: 105.8517, addresses: ['Giải Phóng', 'Tam Trinh', 'Linh Đàm', 'Yên Sở'] },
    { district: 'Hà Đông', lat: 20.9719, lng: 105.7765, addresses: ['Quang Trung', 'Phố Mới', 'Văn Quán', 'Mộ Lao'] },
];

const productNames = [
    'Điện thoại iPhone 15 Pro',
    'Laptop Dell XPS 15',
    'Máy tính bảng Samsung Galaxy Tab',
    'Tai nghe Sony WH-1000XM5',
    'Đồng hồ thông minh Apple Watch',
    'Camera GoPro Hero 12',
    'Máy ảnh Canon EOS R6',
    'Tủ lạnh Panasonic',
    'Máy giặt LG',
    'Tivi Samsung 55 inch',
    'Quần áo thời trang',
    'Giày dép Nike',
    'Sách giáo khoa',
    'Đồ chơi trẻ em',
    'Mỹ phẩm cao cấp',
    'Thực phẩm đông lạnh',
    'Thuốc men y tế',
    'Văn phòng phẩm',
    'Đồ nội thất',
    'Phụ kiện ô tô',
];

const contactNames = [
    'Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D', 
    'Hoàng Văn E', 'Vũ Thị F', 'Đặng Văn G', 'Bùi Thị H',
    'Đỗ Văn I', 'Ngô Thị K', 'Dương Văn L', 'Phan Thị M',
];

const phoneNumbers = [
    '0901234567', '0912345678', '0923456789', '0934567890',
    '0945678901', '0956789012', '0967890123', '0978901234',
];

function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(startDays: number, endDays: number): Date {
    const now = new Date();
    const start = new Date(now.getTime() + startDays * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + endDays * 24 * 60 * 60 * 1000);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDateTime(date: Date): string {
    return date.toISOString();
}

function generateTrackingNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `WY${timestamp}${random}`;
}

async function seedOrders() {
    console.log('🌱 Starting orders seed...');

    // Get first organization
    const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .single();

    if (orgError || !orgs) {
        console.error('❌ No organization found. Please create an organization first.');
        process.exit(1);
    }

    const organizationId = orgs.id;
    console.log(`✅ Using organization: ${organizationId}`);

    // Get locations for pickup/delivery
    const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(1)
        .single();

    let defaultLocationId: string;
    if (locations) {
        defaultLocationId = locations.id;
        console.log(`✅ Using location: ${defaultLocationId}`);
    } else {
        // Create a default location
        const { data: newLoc, error: createError } = await supabase
            .from('locations')
            .insert({
                organization_id: organizationId,
                name: 'Depot Mặc định',
                address: 'Số 1 Nguyễn Trãi, Thanh Xuân, Hà Nội',
                latitude: 20.9950,
                longitude: 105.8050,
                location_type: 'warehouse',
            })
            .select('id')
            .single();
        
        if (createError || !newLoc) {
            console.error('❌ Failed to create default location:', createError);
            process.exit(1);
        }
        defaultLocationId = newLoc.id;
        console.log(`✅ Created default location: ${defaultLocationId}`);
    }

    const orders = [];
    const statuses = ['pending', 'assigned', 'in_transit', 'picked_up', 'delivered', 'cancelled'];
    const priorities = ['low', 'normal', 'high', 'urgent'];

    console.log('📦 Generating 50 sample orders...');

    for (let i = 0; i < 50; i++) {
        const pickupLoc = randomItem(hanoiLocations);
        const deliveryLoc = randomItem(hanoiLocations.filter(l => l.district !== pickupLoc.district));
        
        const pickupStreet = randomItem(pickupLoc.addresses);
        const deliveryStreet = randomItem(deliveryLoc.addresses);

        const pickupTime = randomDate(0, 7);
        const deliveryTime = new Date(pickupTime.getTime() + randomInt(2, 8) * 60 * 60 * 1000);

        const pickupTimeEnd = new Date(pickupTime.getTime() + 2 * 60 * 60 * 1000);
        const deliveryTimeEnd = new Date(deliveryTime.getTime() + 2 * 60 * 60 * 1000);

        const order = {
            organization_id: organizationId,
            tracking_number: generateTrackingNumber(),
            reference_code: `REF${randomInt(10000, 99999)}`,
            status: randomItem(statuses),
            priority: randomItem(priorities),
            
            product_name: randomItem(productNames),
            product_value: randomFloat(100000, 50000000, 0),
            weight: randomFloat(0.5, 50, 1),
            volume: randomFloat(0.001, 2, 3),
            
            pickup_location_id: defaultLocationId,
            pickup_contact_name: randomItem(contactNames),
            pickup_contact_phone: randomItem(phoneNumbers),
            pickup_address: `${randomInt(1, 999)} ${pickupStreet}, ${pickupLoc.district}, Hà Nội`,
            pickup_latitude: pickupLoc.lat + randomFloat(-0.01, 0.01, 6),
            pickup_longitude: pickupLoc.lng + randomFloat(-0.01, 0.01, 6),
            pickup_time_start: formatDateTime(pickupTime),
            pickup_time_end: formatDateTime(pickupTimeEnd),
            pickup_notes: Math.random() > 0.7 ? 'Gọi trước 15 phút' : null,
            
            delivery_location_id: defaultLocationId,
            delivery_contact_name: randomItem(contactNames),
            delivery_contact_phone: randomItem(phoneNumbers),
            delivery_address: `${randomInt(1, 999)} ${deliveryStreet}, ${deliveryLoc.district}, Hà Nội`,
            delivery_latitude: deliveryLoc.lat + randomFloat(-0.01, 0.01, 6),
            delivery_longitude: deliveryLoc.lng + randomFloat(-0.01, 0.01, 6),
            delivery_time_start: formatDateTime(deliveryTime),
            delivery_time_end: formatDateTime(deliveryTimeEnd),
            delivery_notes: Math.random() > 0.7 ? 'Giao trong giờ hành chính' : null,
            
            service_time_pickup: randomInt(5, 20),
            service_time_delivery: randomInt(5, 20),
        };

        orders.push(order);
    }

    console.log('💾 Inserting orders into database...');

    const { data, error } = await supabase
        .from('orders')
        .insert(orders)
        .select();

    if (error) {
        console.error('❌ Error inserting orders:', error);
        process.exit(1);
    }

    console.log(`✅ Successfully seeded ${data?.length || 0} orders!`);
    console.log('🎉 Seed complete!');
}

seedOrders().catch(console.error);
