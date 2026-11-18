import { getSupabase } from '@/lib/supabase';
import { asCustomerNumber } from '@/lib/customer-number-value';

/**
 * The customer's own FixIt number, ready to read out over the phone, or null
 * when the account has none yet or the read failed.
 */
export async function getMyCustomerNumber(userId: string): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase || userId === '') return null;
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('customer_number')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return asCustomerNumber(data?.customer_number);
}
