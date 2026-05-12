import { NextResponse } from 'next/server'

export type ApiOk<T> = { ok: true; data: T }
export type ApiErr = { ok: false; error: { message: string; code?: string } }

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data } satisfies ApiOk<T>, { status })
}

export function jsonErr(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { ok: false, error: { message, code } } satisfies ApiErr,
    { status },
  )
}
