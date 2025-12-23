/**
 * Check current user's organization and optionally seed orders for it
 * Run: npx tsx scripts/check-user-org.ts [user_email]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserOrganization() {
    // Get all users with their organizations
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
            id,
            email,
            full_name,
            organization_id,
            organizations (
                id,
                name
            )
        `)
        .limit(10);

    if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
    }

    console.log('\n📋 Users and their organizations:');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const user of users || []) {
        console.log(`👤 ${user.full_name || user.email}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   User ID: ${user.id}`);
        console.log(`   Org ID: ${user.organization_id}`);
        const org = Array.isArray(user.organizations) ? user.organizations[0] : user.organizations;
        console.log(`   Org Name: ${org?.name || 'N/A'}`);
        
        // Count orders for this organization
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', user.organization_id);
        
        console.log(`   📦 Orders count: ${count || 0}\n`);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('\n💡 Tip: To seed orders for a specific organization:');
    console.log('   Edit scripts/seed-orders.ts and change the organization_id');
    console.log('   Or run: npx tsx scripts/seed-orders-for-org.ts <org_id>\n');
}

checkUserOrganization().catch(console.error);
