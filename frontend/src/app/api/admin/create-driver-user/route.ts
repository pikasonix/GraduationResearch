import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create Supabase client with service role key (server-side only)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key - NEVER expose to client
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, phone, organization_id, team_id, is_active } = body;

    // Validate required fields
    if (!email || !password || !full_name || !phone || !organization_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Auto-generate driver_code
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const driver_code = `TX${timestamp}${random}`;

    // Create user with admin API (won't affect current client session)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
        role: 'driver',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        return NextResponse.json(
          { error: 'Email này đã được đăng ký. Vui lòng sử dụng email khác.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `Không thể tạo tài khoản: ${authError.message}` },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Không nhận được thông tin người dùng' },
        { status: 500 }
      );
    }

    // Create driver record
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .insert({
        organization_id,
        user_id: authData.user.id,
        driver_code,
        full_name,
        phone,
        is_active,
        team_id: team_id || null,
      })
      .select()
      .single();

    if (driverError) {
      console.error('Error creating driver record:', driverError);
      return NextResponse.json(
        { error: `Không thể tạo hồ sơ tài xế: ${driverError.message}` },
        { status: 500 }
      );
    }

    // Create user record in users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        phone,
        role: 'driver',
        organization_id,
      });

    if (userError) {
      console.error('Error creating user record:', userError);
      // Continue anyway as driver is created
    }

    return NextResponse.json(
      { 
        success: true,
        driver,
        message: 'Đã tạo tài xế thành công'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in create-driver-user API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
