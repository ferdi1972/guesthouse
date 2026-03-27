import React from 'react';
import { Hotel, ArrowRight, Bed, Users, CalendarDays, ShieldCheck, MapPin, Phone, Mail, ChevronRight } from 'lucide-react';
import { Settings } from '../types';

interface LandingPageProps {
  settings: Settings | null;
  onSignIn: () => void;
}

export default function LandingPage({ settings, onSignIn }: LandingPageProps) {
  const title = settings?.landingTitle || settings?.companyName || 'Stay@Edison';
  const description = settings?.landingDescription || 'Experience comfort and luxury in the heart of the city. Your perfect getaway starts here.';
  const buttonText = settings?.landingButtonText || 'Sign In to Manager';
  const bgImage = settings?.landingImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1920';

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#1a1a1a] font-sans selection:bg-[#5A5A40] selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#f5f2ed]/80 backdrop-blur-md border-b border-[#1a1a1a]/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#5A5A40] flex items-center justify-center text-white shadow-lg shadow-[#5A5A40]/20">
              <Hotel className="w-6 h-6" />
            </div>
            <span className="font-serif italic text-2xl tracking-tight">{settings?.companyName || 'Manager'}</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium uppercase tracking-widest opacity-60">
            <a href="#features" className="hover:opacity-100 transition-opacity">Features</a>
            <a href="#about" className="hover:opacity-100 transition-opacity">About</a>
            <a href="#contact" className="hover:opacity-100 transition-opacity">Contact</a>
          </div>
          <button 
            onClick={onSignIn}
            className="px-6 py-2.5 rounded-full bg-[#5A5A40] text-white font-medium hover:bg-[#4a4a35] transition-all shadow-lg shadow-[#5A5A40]/20 flex items-center gap-2 group"
          >
            {buttonText}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={bgImage} 
            alt="Hero" 
            className="w-full h-full object-cover scale-105 animate-slow-zoom"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f5f2ed] via-[#f5f2ed]/80 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-3xl space-y-8 animate-in slide-in-from-left duration-1000">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] text-xs font-bold uppercase tracking-[0.2em]">
              <ShieldCheck className="w-4 h-4" />
              Premium Management Suite
            </div>
            
            <h1 className="font-serif text-6xl md:text-8xl leading-[0.85] tracking-tighter">
              {title.split(' ').map((word, i) => (
                <React.Fragment key={i}>
                  {i === 1 ? <span className="italic text-[#5A5A40]">{word} </span> : word + ' '}
                  {i === 1 && <br />}
                </React.Fragment>
              ))}
            </h1>

            <p className="text-xl md:text-2xl text-[#1a1a1a]/60 max-w-xl leading-relaxed font-light">
              {description}
            </p>

            <div className="flex flex-wrap gap-6 pt-4">
              <button 
                onClick={onSignIn}
                className="px-10 py-5 rounded-full bg-[#1a1a1a] text-white font-bold text-lg hover:bg-[#333] transition-all shadow-2xl shadow-black/20 flex items-center gap-4 group"
              >
                Get Started Now
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
              
              <div className="flex items-center gap-4 px-6 py-5 rounded-full border border-[#1a1a1a]/10 bg-white/50 backdrop-blur-sm">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#f5f2ed] bg-stone-200 overflow-hidden">
                      <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <p className="font-bold">500+ Managers</p>
                  <p className="text-[10px] uppercase tracking-widest opacity-50">Trust our platform</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vertical Rail Text */}
        <div className="absolute right-10 bottom-20 hidden lg:block">
          <div className="writing-mode-vertical-rl rotate-180 text-[10px] font-bold uppercase tracking-[0.5em] opacity-20">
            ESTABLISHED • MMXXVI • PREMIUM QUALITY
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-end mb-24">
            <div className="space-y-6">
              <h2 className="font-serif italic text-5xl md:text-6xl tracking-tight">
                Crafted for the <br /> modern host.
              </h2>
              <div className="h-1 w-20 bg-[#5A5A40]" />
            </div>
            <p className="text-xl text-[#1a1a1a]/50 leading-relaxed max-w-md">
              We've distilled years of hospitality expertise into a single, intuitive interface that works as hard as you do.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { 
                icon: Bed, 
                title: 'Room Management', 
                desc: 'Intelligent occupancy tracking with real-time status updates and maintenance logs.',
                number: '01'
              },
              { 
                icon: Users, 
                title: 'Guest Experience', 
                desc: 'Personalized guest profiles, history tracking, and automated communication tools.',
                number: '02'
              },
              { 
                icon: CalendarDays, 
                title: 'Smart Bookings', 
                desc: 'A seamless reservation engine that handles complex scheduling with effortless grace.',
                number: '03'
              }
            ].map((feature, i) => (
              <div key={i} className="group relative p-10 rounded-[40px] bg-[#f5f2ed]/50 border border-[#1a1a1a]/5 hover:bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="absolute top-10 right-10 font-serif italic text-4xl opacity-5 group-hover:opacity-10 transition-opacity">
                  {feature.number}
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center text-[#5A5A40] mb-8 group-hover:scale-110 transition-transform duration-500">
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-[#1a1a1a]/60 leading-relaxed">{feature.desc}</p>
                <div className="mt-8 flex items-center gap-2 text-[#5A5A40] font-bold text-sm uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                  Learn More <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Split Layout Section */}
      <section id="about" className="bg-[#1a1a1a] text-white overflow-hidden">
        <div className="grid lg:grid-cols-2">
          <div className="p-12 md:p-24 space-y-12 flex flex-col justify-center">
            <div className="space-y-6">
              <h2 className="font-serif text-5xl md:text-7xl leading-tight tracking-tighter">
                Details <br /> <span className="italic opacity-50">Matter.</span>
              </h2>
              <p className="text-xl text-white/60 leading-relaxed font-light">
                From automated receipts to electricity usage tracking, we handle the complexities so you can focus on what truly matters: your guests.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-2">
                <p className="text-4xl font-serif italic">99.9%</p>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-40">Uptime Reliability</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-serif italic">24/7</p>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-40">Dedicated Support</p>
              </div>
            </div>

            <button 
              onClick={onSignIn}
              className="w-fit px-8 py-4 rounded-full border border-white/20 hover:bg-white hover:text-[#1a1a1a] transition-all flex items-center gap-3 group"
            >
              Explore the Dashboard
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="relative aspect-square lg:aspect-auto min-h-[500px]">
            <img 
              src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1200" 
              alt="Interior Detail" 
              className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-[#5A5A40]/20 mix-blend-multiply" />
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-[60px] p-12 md:p-24 shadow-2xl border border-[#1a1a1a]/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#f5f2ed] rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10 grid lg:grid-cols-2 gap-20">
              <div className="space-y-8">
                <h2 className="font-serif italic text-5xl md:text-6xl tracking-tight">Get in touch.</h2>
                <p className="text-xl text-[#1a1a1a]/50 leading-relaxed">
                  Have questions about our platform? Our team is here to help you elevate your business.
                </p>
                
                <div className="space-y-6 pt-8">
                  <div className="flex items-center gap-6 group cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-[#f5f2ed] flex items-center justify-center text-[#5A5A40] group-hover:bg-[#5A5A40] group-hover:text-white transition-all">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-40">Call Us</p>
                      <p className="text-lg font-medium">{settings?.phone || '+27 (0) 12 345 6789'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 group cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-[#f5f2ed] flex items-center justify-center text-[#5A5A40] group-hover:bg-[#5A5A40] group-hover:text-white transition-all">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-40">Email Us</p>
                      <p className="text-lg font-medium">{settings?.email || 'hello@guesthouse.com'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 group cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-[#f5f2ed] flex items-center justify-center text-[#5A5A40] group-hover:bg-[#5A5A40] group-hover:text-white transition-all">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-40">Visit Us</p>
                      <p className="text-lg font-medium">{settings?.address || '123 Luxury Lane, Cape Town'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#f5f2ed] rounded-[40px] p-10 space-y-6">
                <h3 className="text-2xl font-bold">Quick Inquiry</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Full Name</label>
                    <input type="text" className="w-full bg-white border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#5A5A40] transition-all" placeholder="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Message</label>
                    <textarea className="w-full bg-white border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#5A5A40] transition-all h-32" placeholder="How can we help?" />
                  </div>
                  <button className="w-full py-5 rounded-2xl bg-[#5A5A40] text-white font-bold hover:bg-[#4a4a35] transition-all shadow-xl shadow-[#5A5A40]/20">
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-[#1a1a1a]/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#5A5A40] flex items-center justify-center text-white">
                <Hotel className="w-4 h-4" />
              </div>
              <span className="font-serif italic text-xl">{settings?.companyName || 'Manager'}</span>
            </div>
            
            <div className="flex gap-12 text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
              <a href="#" className="hover:opacity-100 transition-opacity">Privacy Policy</a>
              <a href="#" className="hover:opacity-100 transition-opacity">Terms of Service</a>
              <a href="#" className="hover:opacity-100 transition-opacity">Cookie Policy</a>
            </div>

            <p className="text-xs text-[#1a1a1a]/40 uppercase tracking-widest">
              © {new Date().getFullYear()} All Rights Reserved
            </p>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slow-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 20s infinite alternate ease-in-out;
        }
        .writing-mode-vertical-rl {
          writing-mode: vertical-rl;
        }
      `}} />
    </div>
  );
}

