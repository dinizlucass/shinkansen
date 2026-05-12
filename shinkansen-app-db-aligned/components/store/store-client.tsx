"use client"

import React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
// DB writes now happen through our backend (Route Handler) in /app/api
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AnimatedLogo } from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"
import { FadeIn, SlideIn } from "@/components/page-transition"
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2,
  Package,
  Film,
  Camera,
  Loader2,
  CheckCircle2,
  Search
} from "lucide-react"
import type { User } from "@supabase/supabase-js"

interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  image_url?: string
  stock_quantity: number
}

interface CartItem {
  product: Product
  quantity: number
}

interface StoreClientProps {
  user: User | null
  products: Product[]
}

const categoryIcons: Record<string, React.ReactNode> = {
  film: <Film className="h-5 w-5" />,
  camera: <Camera className="h-5 w-5" />,
  accessories: <Package className="h-5 w-5" />,
}

export function StoreClient({ user, products }: StoreClientProps) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)
  const [email, setEmail] = useState(user?.email || "")

  const categories = [...new Set(products.map(p => p.category))]

  const filteredProducts = products.filter(product => {
    const matchesSearch = searchQuery === "" || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) }
            : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = Math.max(1, Math.min(item.quantity + delta, item.product.stock_quantity))
        return { ...item, quantity: newQuantity }
      }
      return item
    }))
  }

  const cartTotal = cart.reduce((total, item) => total + (item.product.price * item.quantity), 0)
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0)

  const handleCheckout = async () => {
    if (!email) return

    setIsCheckingOut(true)
    try {
      const payload = {
        email: user ? undefined : email,
        items: cart.map((item) => ({
          productId: String(item.product.id),
          quantity: item.quantity,
        })),
      }

      const res = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        const message = json?.error?.message || 'Falha ao finalizar compra.'
        throw new Error(message)
      }

      setCart([])
      setCheckoutSuccess(true)
      router.refresh()
    } catch (error) {
      console.error("Checkout error:", error)
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <AnimatedLogo className="w-40 h-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <GameMenuNav user={user} variant="horizontal" />
            
            {/* Cart button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative font-mono bg-transparent">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  CART
                  {cartCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {cartCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg bg-card">
                <SheetHeader>
                  <SheetTitle className="font-mono text-xl">SHOPPING CART</SheetTitle>
                </SheetHeader>
                
                {checkoutSuccess ? (
                  <div className="flex flex-col items-center justify-center h-[60vh]">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-20 h-20 border-4 border-green-500 flex items-center justify-center mb-6"
                    >
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </motion.div>
                    <h3 className="font-mono text-xl font-bold mb-2">ORDER PLACED!</h3>
                    <p className="text-muted-foreground font-mono text-sm text-center">
                      Thank you for your purchase. We will notify you when your order is ready.
                    </p>
                    <Button 
                      className="mt-6 font-mono uppercase"
                      onClick={() => setCheckoutSuccess(false)}
                    >
                      CONTINUE SHOPPING
                    </Button>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[60vh]">
                    <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-mono">Your cart is empty</p>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col h-[calc(100vh-8rem)]">
                    <div className="flex-1 overflow-auto space-y-4">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded">
                          <div className="flex-1">
                            <p className="font-mono font-bold">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              ${item.product.price.toFixed(2)} each
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => updateQuantity(item.product.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-mono w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              disabled={item.quantity >= item.product.stock_quantity}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive bg-transparent"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border pt-4 mt-4 space-y-4">
                      {!user && (
                        <div>
                          <label className="font-mono text-xs uppercase text-muted-foreground mb-2 block">
                            Email for order updates
                          </label>
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="font-mono bg-input"
                          />
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="font-mono text-lg">TOTAL</span>
                        <span className="font-mono text-2xl font-bold text-primary">
                          ${cartTotal.toFixed(2)}
                        </span>
                      </div>

                      <Button
                        className="w-full font-mono uppercase h-12"
                        disabled={isCheckingOut || (!user && !email)}
                        onClick={handleCheckout}
                      >
                        {isCheckingOut ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "CHECKOUT"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <FadeIn>
          <h1 className="text-3xl font-mono font-bold mb-2">PHOTOLAB STORE</h1>
          <p className="text-muted-foreground font-mono text-sm mb-8">
            Film, cameras, and photography supplies
          </p>
        </FadeIn>

        {/* Search and filters */}
        <SlideIn direction="up" delay={0.1}>
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 font-mono bg-input"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={categoryFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter("all")}
                className={`font-mono text-xs uppercase ${categoryFilter !== "all" ? "bg-transparent" : ""}`}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={categoryFilter === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(category)}
                  className={`font-mono text-xs uppercase ${categoryFilter !== category ? "bg-transparent" : ""}`}
                >
                  {categoryIcons[category]}
                  <span className="ml-2">{category}</span>
                </Button>
              ))}
            </div>
          </div>
        </SlideIn>

        {/* Products grid */}
        <FadeIn delay={0.2}>
          {filteredProducts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-mono">No products found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  onAddToCart={() => addToCart(product)}
                  isInCart={cart.some(item => item.product.id === product.id)}
                />
              ))}
            </div>
          )}
        </FadeIn>
      </main>
    </div>
  )
}

function ProductCard({
  product,
  index,
  onAddToCart,
  isInCart,
}: {
  product: Product
  index: number
  onAddToCart: () => void
  isInCart: boolean
}) {
  const isOutOfStock = product.stock_quantity <= 0

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <Card className={`group border-border hover:border-primary/50 transition-all ${isOutOfStock ? "opacity-50" : ""}`}>
          {/* Product image placeholder */}
          <div className="aspect-square bg-muted/30 flex items-center justify-center border-b border-border">
            {categoryIcons[product.category] || <Package className="h-12 w-12 text-muted-foreground" />}
          </div>
          
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <Badge variant="outline" className="font-mono text-xs capitalize">
                {product.category}
              </Badge>
              {isOutOfStock && (
                <Badge variant="destructive" className="font-mono text-xs">
                  Out of Stock
                </Badge>
              )}
            </div>
            
            <h3 className="font-mono font-bold mb-1">{product.name}</h3>
            <p className="text-sm text-muted-foreground font-mono mb-4 line-clamp-2">
              {product.description}
            </p>
            
            <div className="flex items-center justify-between">
              <span className="font-mono text-xl font-bold text-primary">
                ${product.price.toFixed(2)}
              </span>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    disabled={isOutOfStock}
                    onClick={onAddToCart}
                    className={`font-mono text-xs uppercase ${isInCart ? "bg-secondary text-secondary-foreground" : ""}`}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {isInCart ? "ADD MORE" : "ADD"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-card border-primary">
                  <p className="font-mono text-xs">
                    {isOutOfStock ? "Currently unavailable" : `${product.stock_quantity} in stock`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  )
}
