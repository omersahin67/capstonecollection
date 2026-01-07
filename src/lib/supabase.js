// Supabase bağlantı dosyası
// Bu dosya Supabase ile bağlantı kurmak için kullanılır

import { createClient } from '@supabase/supabase-js'

// .env dosyasından API bilgilerini al
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Hata kontrolü - .env dosyası yüklenmemişse uyarı ver
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ HATA: .env dosyası bulunamadı veya API bilgileri eksik!')
  console.error('Lütfen frontend/.env dosyasını oluşturun ve şu içeriği ekleyin:')
  console.error('VITE_SUPABASE_URL=https://gbeixxyqfyrzydrmgxmb.supabase.co')
  console.error('VITE_SUPABASE_ANON_KEY=sb_publishable_eqiH5ld7FRHKA3G8MRoN1A_BWiomSuJ')
}

// Supabase client oluştur
// Bu client tüm Supabase işlemleri için kullanılacak
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
