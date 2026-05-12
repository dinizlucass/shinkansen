"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { FadeIn } from "@/components/page-transition"
import { AnimatedLogo } from "@/components/animated-logo"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-8">
      <div className="max-w-md text-center">
        <FadeIn delay={0.1}>
          <AnimatedLogo className="w-48 h-auto mx-auto mb-8" />
        </FadeIn>

        <FadeIn delay={0.2}>
          <motion.div
            className="w-24 h-24 border-4 border-destructive mx-auto mb-8 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </motion.div>
        </FadeIn>

        <FadeIn delay={0.4}>
          <h1 className="text-3xl font-mono font-bold mb-4">ERRO DE AUTENTICACAO</h1>
          <p className="text-muted-foreground font-mono text-sm mb-8">
            Algo deu errado durante a autenticacao. Isso pode acontecer por um link expirado ou por uma
            solicitacao invalida. Tente novamente.
          </p>
        </FadeIn>

        <FadeIn delay={0.5}>
          <div className="space-y-4">
            <Button asChild className="w-full font-mono uppercase tracking-wider h-12">
              <Link href="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                TENTAR NOVAMENTE
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full font-mono uppercase tracking-wider h-12 bg-transparent">
              <Link href="/">VOLTAR PARA O INICIO</Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
