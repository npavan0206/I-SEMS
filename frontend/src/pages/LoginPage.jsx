import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Sun, Moon, Zap, Shield, BarChart3 } from 'lucide-react';
import { api } from '@/services/api';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        const data = await api.login(email, password);
        login(data.access_token, data.user);
        toast.success('Welcome back!');
        navigate('/');
      } else {
        const data = await api.register(email, password, name);
        login(data.access_token, data.user);
        toast.success('Account created successfully!');
        navigate('/');
      }
    } catch (error) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0B0C10] to-[#1F2833]">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 w-full">
          <div className="max-w-md text-center">
            {/* Logo */}
            <div className="mb-8 flex justify-center">
              <div className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center shadow-glow-primary">
                <Zap className="w-12 h-12 text-primary" />
              </div>
            </div>
            
            <h1 className="font-rajdhani font-bold text-5xl text-white mb-4 tracking-tight">
              ISEMS
            </h1>
            <p className="font-rajdhani text-xl text-primary mb-8 tracking-wide">
              Intelligent Solar Energy Management System
            </p>
            
            <p className="text-slate-400 text-lg leading-relaxed mb-12">
              Industrial-grade platform for real-time solar monitoring, 
              AI-powered predictions, and smart load optimization.
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-3 gap-6 text-center">
              <div className="p-4">
                <div className="w-12 h-12 rounded-full bg-solar/20 flex items-center justify-center mx-auto mb-3">
                  <Sun className="w-6 h-6 text-solar" />
                </div>
                <p className="text-sm text-slate-400 font-inter">Real-time Monitoring</p>
              </div>
              <div className="p-4">
                <div className="w-12 h-12 rounded-full bg-battery/20 flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="w-6 h-6 text-battery" />
                </div>
                <p className="text-sm text-slate-400 font-inter">AI Predictions</p>
              </div>
              <div className="p-4">
                <div className="w-12 h-12 rounded-full bg-grid/20 flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-grid" />
                </div>
                <p className="text-sm text-slate-400 font-inter">Smart Control</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Theme Toggle */}
          <div className="flex justify-end mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
              data-testid="theme-toggle-btn"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-solar" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-rajdhani font-bold text-3xl mb-1">ISEMS</h1>
            <p className="text-muted-foreground text-sm">Solar Energy Management</p>
          </div>

          {/* Form Card */}
          <div className="glass-card rounded-2xl p-8">
            <h2 className="font-rajdhani font-bold text-2xl mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {isLogin 
                ? 'Sign in to access your dashboard' 
                : 'Register to start monitoring your solar system'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-rajdhani text-sm uppercase tracking-wider">
                    Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="input-glass"
                    required={!isLogin}
                    data-testid="register-name-input"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="font-rajdhani text-sm uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-glass"
                  required
                  data-testid="login-email-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="font-rajdhani text-sm uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-glass"
                  required
                  minLength={6}
                  data-testid="login-password-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-primary h-11"
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                data-testid="toggle-auth-mode-btn"
              >
                {isLogin 
                  ? "Don't have an account? Register" 
                  : 'Already have an account? Sign In'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-8">
             EEE_2022-2026
          </p>
        </div>
      </div>
    </div>
  );
}
