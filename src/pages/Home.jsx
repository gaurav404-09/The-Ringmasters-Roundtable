import { Suspense } from 'react';
import { Button } from '../components/ui/button';
import FerrisWheel3D from '../components/FerrisWheel3D';
import FeatureCard from '../components/FeatureCard';
import CircusCard from '../components/CircusCard';
import { 
  MapPin, 
  Cloud, 
  CreditCard, 
  Calendar, 
  Users, 
  Sparkles,
  Camera,
  Navigation
} from 'lucide-react';
// Using a placeholder image URL for now
import circusHero from '/assets/images/placeholder-circus-hero.jpg';

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* 3D Ferris Wheel Background */}
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="absolute text-circus-cream text-2xl font-bold animate-pulse z-10">
            Loading the magical 3D wheel...
          </div>
          <FerrisWheel3D /> {/* Use the SVG fallback during initial load */}
        </div>
      }>
        <FerrisWheel3D />
      </Suspense>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center p-0 m-0 w-full overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10 w-full h-full m-0 p-0"
          style={{ 
            backgroundImage: 'url(https://static.vecteezy.com/system/resources/thumbnails/039/895/030/small_2x/ai-generated-a-whimsical-circus-tent-background-adorned-with-striped-awnings-twinkling-lights-free-photo.jpg)',
            animation: 'pulse 8s ease-in-out infinite',
            transform: 'scale(1.05)',
            minHeight: '100vh',
            minWidth: '100vw',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        />
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="mb-8 animate-float">
            <Sparkles className="w-16 h-16 text-circus-yellow mx-auto mb-4 animate-ping-slow hover:animate-spin hover:scale-125 transition-all duration-300" />
          </div>
          
          <h1 className="text-6xl md:text-8xl font-circus mb-6 bg-gradient-to-r from-circus-yellow to-circus-orange bg-clip-text text-transparent animate-bounce hover:animate-wiggle transition-all duration-300">
            The Ringmaster's Roundtable
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed">
            Uniting scouts, gazers, and planners for the perfect tour.
            <br />
            <span className="text-circus-yellow font-semibold">Plan your magical journey through the Circus of Wonders.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-circus-red hover:bg-circus-red/90 text-circus-cream shadow-circus-red px-8 py-4 text-lg font-semibold rounded-full transform hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-circus-red/50 animate-pulse hover:animate-none"
            >
              Start Planning Your Adventure
            </Button>
            <Button 
              size="lg"
              style={{
                backgroundImage: 'url(https://static.vecteezy.com/system/resources/thumbnails/025/337/005/small_2x/circus-tent-illustration-ai-generative-photo.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
              className="border-circus-yellow text-circus-yellow hover:bg-circus-yellow hover:text-background px-8 py-4 text-lg font-semibold rounded-full transform hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-circus-yellow/30 animate-pulse hover:animate-none"
            >
              Explore Features
            </Button>
          </div>
        </div>
      </section>

      {/* Basic Features Section */}
      <section className="relative py-20 px-4 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display text-circus-cream mb-4 animate-fade-in-up hover:animate-pulse">
              Basic Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to plan the perfect circus tour adventure.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Calendar className="w-12 h-12" />}
              title="Web-based Dashboard"
              description="A simple interface where users can input their destination and travel dates."
              color="blue"
            />
            
            <FeatureCard
              icon={<Cloud className="w-12 h-12" />}
              title="Weather Agent"
              description="Fetches weather forecast for the travel dates to help you pack accordingly."
              color="gold"
            />
            
            <FeatureCard
              icon={<MapPin className="w-12 h-12" />}
              title="Maps Agent"
              description="Shows travel routes with distance and time estimates for your journey."
              color="red"
            />
            
            <FeatureCard
              icon={<CreditCard className="w-12 h-12" />}
              title="Budget Estimator"
              description="Rough cost breakdown of travel including fuel, transport, and flights."
              color="blue"
            />
          </div>
        </div>
      </section>

      {/* Intermediate Features Section */}
      <section className="relative py-20 px-4 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display text-circus-cream mb-4 animate-fade-in-up hover:animate-pulse">
              Intermediate Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Advanced planning tools for the ultimate circus experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Users className="w-12 h-12" />}
              title="Multi-Agent Orchestra"
              description="Weather, Maps, and Events agents work together for comprehensive planning."
              color="gold"
            />
            
            <FeatureCard
              icon={<Navigation className="w-12 h-12" />}
              title="Step-by-Step Guidance"
              description="Simple itinerary generation with detailed explanations in easy language."
              color="red"
            />
            
            <FeatureCard
              icon={<Camera className="w-12 h-12" />}
              title="Trip Summary Card"
              description="Beautiful cards displaying weather and route details in an elegant format."
              color="blue"
            />
            
            <FeatureCard
              icon={<Sparkles className="w-12 h-12" />}
              title="Magic Planning"
              description="AI-powered suggestions for the most enchanting circus tour experience."
              color="gold"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-4 z-10">
        <div className="max-w-4xl mx-auto text-center">
          <CircusCard variant="glass" className="text-center">
            <Sparkles className="w-16 h-16 text-circus-yellow mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-display text-circus-cream mb-6">
              Ready to Join the Circus?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Let our expert agents help you create the perfect tour plan.
              <br />
              The greatest show on earth awaits your arrival!
            </p>
            <Button 
              size="lg"
              className="bg-circus-red hover:bg-circus-red/90 text-circus-cream shadow-circus-red px-12 py-4 text-xl font-bold rounded-full transform hover:scale-105 transition-transform"
            >
              Begin Your Magical Journey
            </Button>
          </CircusCard>
        </div>
      </section>
    </div>
  );
};

export default Index;