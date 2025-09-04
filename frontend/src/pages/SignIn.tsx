import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'

export default function SignIn() {
    return (
        <div className="min-h-screen grid place-items-center p-6">
            <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />
        </div>
    )
}
