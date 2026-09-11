import React from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME_DISPLAY } from '../../constants/branding.js';

export function LandingPage() {
    const navigate = useNavigate();

    function StatCard({ number, label, variant = 'white' }) {
        return (
            <div className={`flex flex-col items-center justify-center p-6 ${
                variant === 'white' ? 'bg-white' : 'bg-primary-end'
            }`}>
                <span className={`text-4xl font-bold ${
                    variant === 'white' ? 'text-gray-800' : 'text-white'
                }`}>{number}</span>
                <span className={`mt-2 ${
                    variant === 'white' ? 'text-gray-600' : 'text-white'
                }`}>{label}</span>
            </div>
        );
    }

    function ServiceCard({ icon, title }) {
        return (
            <div className="flex flex-col items-center bg-primary-end p-8 rounded-lg">
                <img src={icon} alt={title} className="w-16 h-16" />
                <span className="mt-4 text-center text-black font-medium">{title}</span>
            </div>
        );
    }

    function DoctorCard({ photo, name, speciality }) {
        return (
            <div className="flex flex-col items-center">
                <div className="w-full aspect-square overflow-hidden bg-emerald-800">
                    <img src="/doctorimage.png" alt={name} className="w-full h-full object-cover" />
                </div>
                <h3 className="mt-3 font-medium text-gray-800">{name}</h3>
                <p className="text-sm text-gray-600">{speciality}</p>
            </div>
        );
    }

    const stats = [
        { number: "50+", label: "Doctor", variant: 'white' },
        { number: "50+", label: "Patients", variant: 'green' },
        { number: "20+", label: "Expert", variant: 'white' },
        { number: "5+", label: "Specializations", variant: 'green' }
    ];

    const services = [
        { icon: "/hospital.png", title: "Specialized Services" },
        { icon: "/injection.png", title: "Vaccination" },
        { icon: "/doctor.png", title: "Diagnostics" },
        { icon: "/heart.png", title: "Dental Care" },
        { icon: "/helpcenter.png", title: "Pharmacy" }
    ];

    return (
        <div className="min-h-screen">
            {/* Hero Section - Blue Gradient Background */}
            <div className="relative bg-gradient-to-br from-primary-start to-primary-end pb-16">
    {/* Image en background avec overlay */}
    <div className="absolute inset-0">
        <img 
            src="/welcomeImage.png"
            alt="Background"
            className="w-full h-full md-5 object-cover" 
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-start/40 to-primary-end/40"></div>
    </div>

    {/* Contenu */}
    <div className="container mx-auto px-6 pt-24 relative z-10">
        <div className="flex flex-col items-center text-center">
            <div className="w-full max-w-2xl">
                <h1 className="text-4xl md:text-5xl font-bold text-white text-left mb-4">
                    Welcome to<br />
                    {APP_NAME_DISPLAY}
                </h1>
                <p className="text-white/80 text-left text-lg mb-8">
                    The hospital to trust to care about those you love
                </p>
                <button
                    onClick={() => navigate("/login")}
                    className="px-8 py-3 bg-white text-gray-800 text-left rounded-full font-medium hover:bg-opacity-90 transition-all"
                >
                    Log In Now
                </button>
            </div>
        </div>
    </div>
</div>
            {/* Stats Section - Overlapping Cards */}
            <div className="container mx-auto px-6 mt-3 over">
                <div className="grid grid-cols-4 gap-0 -mt-8">
                    {stats.map((stat, index) => (
                        <StatCard key={index} {...stat} />
                    ))}
                </div>
            </div>

            {/* White Background Sections */}
            <div className="bg-white">
                {/* Services Section */}
                <div className="container mx-auto px-6">
                    <section className="py-16">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-800">Our Services</h2>
                            <p className="text-gray-600 mt-2">
                                We bring a fresh and exciting service to the care we provide.
                                Best diagnosis and treatment.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                            {services.map((service, index) => (
                                <ServiceCard key={index} {...service} />
                            ))}
                        </div>
                    </section>

                    {/* Doctors Section */}
                    <section className="py-16">
                        <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">
                            Meet Some of Our Doctors
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[1, 2, 3].map((i) => (
                                <DoctorCard
                                    key={i}
                                    photo="/images/doctor-profile.jpg"
                                    name="Dr. James.Lambert"
                                    speciality="Dentist"
                                />
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            {/* About Section */}
            <div className="bg-emerald-800">
                <div className="container mx-auto px-6">
                    <section className="py-16 relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-3xl font-bold text-white mb-4">About us</h2>
                            <p className="text-white/90 max-w-xl">
                                {APP_NAME_DISPLAY} is committed to providing exceptional healthcare services 
                                through innovative medical solutions and compassionate care...
                            </p>
                        </div>
                        <img 
                            src="/endpicture.png" 
                            alt="About background" 
                            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
                        />
                    </section>
                </div>
            </div>

            <footer className="bg-emerald-800 py-4 text-center text-white">
                <p>© {new Date().getFullYear()} {APP_NAME_DISPLAY}</p>
            </footer>
        </div>
    );
}

export default LandingPage;