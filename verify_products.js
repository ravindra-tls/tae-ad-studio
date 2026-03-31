const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyProducts() {
  console.log('===== VERIFYING PRODUCT DATA IN SUPABASE =====\n');

  // Verify updated products
  const updateIds = [
    '7af546f4-d589-482e-bfdf-3bf87afeb075',
    'ecbce262-6cc1-45d9-b8de-9c6c0bcea398',
    '6f6827dd-7e9d-4e14-aeb5-6c2d79c0d30e'
  ];

  console.log('CHECKING UPDATED PRODUCTS:\n');
  for (const id of updateIds) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, ingredients, claims, context')
      .eq('id', id)
      .single();

    if (error) {
      console.log(`ERROR fetching ${id}:`, error.message);
    } else {
      console.log(`✓ ${data.name}`);
      console.log(`  - ID: ${data.id}`);
      console.log(`  - Ingredients (JSONB): ${Array.isArray(data.ingredients) ? data.ingredients.length + ' items' : 'NOT ARRAY'}`);
      console.log(`  - Claims (JSONB): ${Array.isArray(data.claims) ? data.claims.length + ' items' : 'NOT ARRAY'}`);
      console.log(`  - Context (JSONB): ${typeof data.context === 'object' ? 'Object' : typeof data.context}`);
      console.log();
    }
  }

  // Verify new products
  console.log('CHECKING NEW PRODUCTS:\n');
  const { data: newProducts, error: newError } = await supabase
    .from('products')
    .select('id, name, ingredients, claims, context')
    .in('name', ['Kesaradi Daily Glow', 'Firm-Focus Neck Mask']);

  if (newError) {
    console.log('ERROR fetching new products:', newError.message);
  } else {
    for (const product of newProducts) {
      console.log(`✓ ${product.name}`);
      console.log(`  - ID: ${product.id}`);
      console.log(`  - Ingredients (JSONB): ${Array.isArray(product.ingredients) ? product.ingredients.length + ' items' : 'NOT ARRAY'}`);
      console.log(`  - Claims (JSONB): ${Array.isArray(product.claims) ? product.claims.length + ' items' : 'NOT ARRAY'}`);
      console.log(`  - Context (JSONB): ${typeof product.context === 'object' ? 'Object' : typeof product.context}`);
      console.log();
    }
  }

  // Verify Rufolia Pro was not touched
  console.log('VERIFYING RUFOLIA PRO UNTOUCHED:\n');
  const { data: rufolia, error: rufoliaError } = await supabase
    .from('products')
    .select('id, name')
    .eq('id', '9e9d80e2-e036-4e59-9f08-a5c629812b81')
    .single();

  if (rufoliaError) {
    console.log('ERROR fetching Rufolia:', rufoliaError.message);
  } else {
    console.log(`✓ ${rufolia.name} (ID: ${rufolia.id}) - STILL EXISTS, NOT DELETED`);
  }

  console.log('\n===== VERIFICATION COMPLETE =====');
}

verifyProducts();
