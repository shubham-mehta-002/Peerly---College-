import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabase';

const ADMIN_EMAIL = 'smehta_mca25@thapar.edu';
const ADMIN_PASSWORD = '123!@#qweQWE';
const ADMIN_USERNAME = 'smehta_mca25';
const ADMIN_NAME = 'S Mehta';

const COLLEGE_NAME = 'Thapar Institute of Engineering and Technology';
const CAMPUS_NAME = 'Thapar University, Patiala, Punjab';
const DOMAIN = 'thapar.edu';

async function seed() {
  console.log('Seeding database…');

  // ── College ────────────────────────────────────────────────────────────────
  let collegeId: string;
  const { data: existingCollege } = await supabaseAdmin
    .from('colleges')
    .select('id')
    .eq('name', COLLEGE_NAME)
    .maybeSingle();

  if (existingCollege) {
    collegeId = existingCollege.id;
    console.log(`College already exists: ${collegeId}`);
  } else {
    const { data: college, error } = await supabaseAdmin
      .from('colleges')
      .insert({ name: COLLEGE_NAME, is_active: true })
      .select('id')
      .single();
    if (error || !college) throw new Error(`Failed to insert college: ${error?.message}`);
    collegeId = college.id;
    console.log(`College created: ${collegeId}`);
  }

  // ── Domain ─────────────────────────────────────────────────────────────────
  const { data: existingDomain } = await supabaseAdmin
    .from('college_domains')
    .select('id')
    .eq('domain', DOMAIN)
    .maybeSingle();

  if (existingDomain) {
    console.log(`Domain already exists: ${DOMAIN}`);
  } else {
    const { error } = await supabaseAdmin
      .from('college_domains')
      .insert({ college_id: collegeId, domain: DOMAIN, is_active: true });
    if (error) throw new Error(`Failed to insert domain: ${error.message}`);
    console.log(`Domain created: ${DOMAIN}`);
  }

  // ── Campus ─────────────────────────────────────────────────────────────────
  let campusId: string;
  const { data: existingCampus } = await supabaseAdmin
    .from('campuses')
    .select('id')
    .eq('college_id', collegeId)
    .eq('name', CAMPUS_NAME)
    .maybeSingle();

  if (existingCampus) {
    campusId = existingCampus.id;
    console.log(`Campus already exists: ${campusId}`);
  } else {
    const { data: campus, error } = await supabaseAdmin
      .from('campuses')
      .insert({ college_id: collegeId, name: CAMPUS_NAME, is_active: true })
      .select('id')
      .single();
    if (error || !campus) throw new Error(`Failed to insert campus: ${error?.message}`);
    campusId = campus.id;
    console.log(`Campus created: ${campusId}`);
  }

  // ── Admin user ─────────────────────────────────────────────────────────────
  let adminId: string;
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (existingUser) {
    adminId = existingUser.id;
    console.log(`Admin user already exists: ${adminId}`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: ADMIN_EMAIL,
        password_hash: passwordHash,
        is_admin: true,
        is_email_verified: true,
      })
      .select('id')
      .single();
    if (error || !user) throw new Error(`Failed to insert admin user: ${error?.message}`);
    adminId = user.id;
    console.log(`Admin user created: ${adminId}`);
  }

  // ── Admin profile ──────────────────────────────────────────────────────────
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', adminId)
    .maybeSingle();

  if (existingProfile) {
    // Update campus_id and onboarding_completed in case profile exists but is incomplete
    await supabaseAdmin
      .from('profiles')
      .update({
        name: ADMIN_NAME,
        username: ADMIN_USERNAME,
        campus_id: campusId,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);
    console.log(`Admin profile updated`);
  } else {
    const { error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: adminId,
        name: ADMIN_NAME,
        username: ADMIN_USERNAME,
        campus_id: campusId,
        onboarding_completed: true,
      });
    if (error) throw new Error(`Failed to insert admin profile: ${error.message}`);
    console.log(`Admin profile created`);
  }

  console.log('\n✓ Seed complete');
  console.log(`  Email   : ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  College : ${COLLEGE_NAME}`);
  console.log(`  Campus  : ${CAMPUS_NAME}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
