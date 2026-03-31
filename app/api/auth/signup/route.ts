import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || 'transformative.in,theayurvedaexperience.com').split(',');

export async function POST(request: Request) {
  const { email, password, fullName } = await request.json();

  const domain = email.split('@')[1]?.toLowerCase();
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return NextResponse.json(
      { error: `Sign up restricted to ${ALLOWED_DOMAINS.join(', ')} emails.` },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ user: data.user });
}
