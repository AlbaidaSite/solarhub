import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - api/webhooks/bunny (webhook de Bunny Stream: no trae sesión; se
     *   autentica con su firma HMAC en el propio route handler)
     * - any file with a static asset extension
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/bunny$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
