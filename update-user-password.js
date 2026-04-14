import { createClient } from '@supabase/supabase-js';

// substitua com sua URL do projeto e chave service role (encontrada em Settings → API → Service Role)
const supabaseUrl = 'https://ubwbnpckbwtllitonpjj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVid2JucGNrYnd0bGxpdG9ucGpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTcyODc0MiwiZXhwIjoyMDgxMzA0NzQyfQ.rm7YB4M6E4C0JDgbCfKCTW0Cfy6PTb1TTFD7QIDhqA8';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updatePassword() {
  const userId = '7ac315bc-6f33-4d71-bb70-70e5d36db72c';
  const newPassword = 'Hb600i12c@20261990';

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    console.error('Erro ao atualizar senha:', error);
  } else {
    console.log('Senha atualizada com sucesso:', data);
  }
}

updatePassword();