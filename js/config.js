/**
 * Palora Homes - Official Store & WhatsApp Configuration
 * 
 * Official WhatsApp Number: 919319862081
 * Official Tagline: "Modern Living, Indian Soul"
 */

const PALORA_CONFIG = {
    // Official WhatsApp Business Number
    whatsappNumber: "919319862081",
    whatsappDisplayNumber: "+91 93198 62081",

    // Brand Identity
    companyName: "Palora Homes",
    brandName: "Palora Homes",
    tagline: "Modern Living, Indian Soul",
    businessCategory: "Handcrafted Home Decor & Artisanal Living Accents",
    businessHours: "Monday – Saturday: 10:00 AM – 7:00 PM IST",

    // Default Inquiries
    defaultInquiryMessage: "Hello Palora Homes, I would like to inquire about your Handcrafted Home Decor collections.",
    orderInquiryMessage: "Hello Palora Homes, I am interested in placing an order. Please share your catalog and ordering details.",
    bulkInquiryMessage: "Hello Palora Homes, I am interested in bulk quantity orders for homes, offices, or retail business. Please share wholesale details.",

    // Categories matching front page "Shop by Category"
    categories: [
        {
            id: "wall-decor",
            name: "Wall Decor",
            image: "assets/images/deer-floating-shelves.jpg",
            tagline: "Shelves, Planter Displays & Wall Accents"
        },
        {
            id: "wall-clock",
            name: "Wall Clock",
            image: "assets/images/wall-clock-deer-pendulum.jpg",
            tagline: "Handcrafted Wooden & Artisanal Pendulum Timepieces"
        },
        {
            id: "night-lamp",
            name: "Night Lamp",
            image: "assets/images/heart-3d-led-lamp.png",
            tagline: "3D Illusion LED Night Lamps & Sacred Ambient Glows"
        },
        {
            id: "wall-hanging",
            name: "Wall Hanging",
            image: "assets/images/ganesha-evil-eye-hanging.jpg",
            tagline: "Auspicious Nazar Battu & Sacred Vedic Hangings"
        },
        {
            id: "car-dashboard",
            name: "Car Dashboard Decore",
            image: "assets/images/car-dashboard-hanuman-acd004.png",
            tagline: "Divine Acrylic Deity Frames & Sacred Travel Companions"
        },
        {
            id: "key-holder",
            name: "Key Holder",
            image: "assets/images/key-holder-family-birds-kh082.png",
            tagline: "Solid Wood Organizers & Hook Racks"
        }
    ],

    // Handcrafted Signature Products Catalog
    upcomingCollections: [
        // ================= WALL DECOR PRODUCTS (3 EXCLUSIVE PRODUCTS) =================
        {
            id: "wall-decor-deer",
            category: "wall-decor",
            categoryName: "Wall Decor",
            title: "Deer Silhouette Floating Wall Shelves",
            subtitle: "Artisanal Living Accent & Planter Perches (Pair)",
            specs: "6\" x 8\" (Pair) • Matte Black Finish",
            image: "assets/images/deer-floating-shelves.jpg",
            description: "Artisanal pair of black deer head silhouette wall shelves crafted to display miniature succulent pots, tea lights, or botanical accents with organic elegance.",
            status: "Available for Order",
            highlights: ["Set of 2 Shelves", "Planter Display (6\" x 8\")", "Solid Wall Mount"]
        },
        {
            id: "wall-decor-bird-circle",
            category: "wall-decor",
            categoryName: "Wall Decor",
            title: "Circular Bird Silhouette Wall Shelves",
            subtitle: "Solid Teak Finish Wall Sconces & Display Perches (Pair)",
            specs: "Pair (2 Pcs) • Natural Hardwood Grain",
            image: "assets/images/circular-bird-wall-shelves.png",
            description: "Handcrafted pair of circular wooden wall accent shelves featuring a precision cutout bird perched on a leafy branch, complete with a sturdy display ledge for small botanicals and candles.",
            status: "Available for Order",
            highlights: ["Pair of 2 Shelves", "Carved Bird on Branch", "Solid Hardwood Craft"]
        },
        {
            id: "wall-decor-diamond-sunburst",
            category: "wall-decor",
            categoryName: "Wall Decor",
            title: "Geometric Sunburst Diamond Wall Shelves",
            subtitle: "Boho Radial Lattice Shelves & Planter Ledges (Pair)",
            specs: "Pair (2 Pcs) • Laser Cut Engineered Wood",
            image: "assets/images/diamond-sunburst-wall-shelves.png",
            description: "Striking diamond-silhouette wall shelves adorned with radial sunburst geometric cutouts and a curved wooden ledge ideal for potted succulents, air plants, and decor curios.",
            status: "Available for Order",
            highlights: ["Set of 2 Shelves", "Radial Sunburst Design", "Succulent Planter Perch"]
        },

        // ================= WALL CLOCK (HANDCRAFTED TIMEPIECES) =================
        {
            id: "wall-clock-bird-wwc102",
            category: "wall-clock",
            categoryName: "Wall Clock",
            title: "Bird Silhouette Geometric Wall Clock",
            subtitle: "Dual Perched Birds & Lattice Horizon",
            specs: "16\" x 6\" (Single) • Natural Solid Wood",
            image: "assets/images/wooden-bird-wall-clock.jpg",
            description: "Contemporary rectangular wooden wall clock uniting warm natural wood grain with modern geometric lattice cutouts and two perched bird silhouettes. Features minimalist 12, 9, 6 bold numerals and a silent quartz precision movement.",
            status: "Available for Order",
            highlights: ["16\" x 6\" Size", "Dual Bird Silhouettes", "Geometric Horizon Lattice", "Silent Quartz Movement"]
        },
        {
            id: "wall-clock-deer-pendulum-wwc102",
            category: "wall-clock",
            categoryName: "Wall Clock",
            title: "Nordic Deer Antler Pendulum Wall Clock",
            subtitle: "Minimalist Dial, Antler Crown & Swinging Pendulum",
            specs: "12\" x 12\" (Single) • Silent Quartz Movement",
            image: "assets/images/wall-clock-deer-pendulum.jpg",
            description: "Scandinavian-style modern wall clock boasting a minimalist open-ring white dial, rich walnut center column, bold sculptural black deer antlers, and a calming swinging wooden pendulum. Engineered with ultra-quiet quartz precision.",
            status: "Available for Order",
            highlights: ["12\" x 12\" Size", "Swinging Pendulum", "Sculptural Deer Antlers", "Silent Quartz Movement"]
        },
        {
            id: "wall-clock-modern-oval",
            category: "wall-clock",
            categoryName: "Wall Clock",
            title: "Nordic Minimalist Oval Wooden Wall Clock",
            subtitle: "Slim Stadium Silhouette with Natural Wood Face & Matte Black Rim",
            specs: "18\" x 6\" • Natural Wood & Matte Black Rim",
            image: "assets/images/wall-clock-modern-oval-wood.png",
            description: "Sleek, architectural oval wall clock featuring a warm natural wood veneer face, bold minimalist 12 and 6 stencil typography, matte black border, and silent sweep quartz movement.",
            status: "Available for Order",
            highlights: ["18\" x 6\" Slim Oval Design", "Natural Hardwood Texture", "Silent Sweep Quartz Movement", "Modern Architectural Accent"]
        },
        {
            id: "wall-clock-lion-silhouette",
            category: "wall-clock",
            categoryName: "Wall Clock",
            title: "Majestic Lion Mane Silhouette Wall Clock",
            subtitle: "Bold Wildlife Profile Clock with Flowing Mane & Quiet Quartz Hands",
            specs: "12\" x 12\" • Matte Black Engineered Craft • Quiet Movement",
            image: "assets/images/wall-clock-lion-silhouette.png",
            description: "Statement wildlife silhouette wall clock capturing the noble profile of a lion with an intricately sculpted flowing mane framing a clean 12-hour numeral dial, paired with high-contrast white hands and a vibrant red second needle.",
            status: "Available for Order",
            highlights: ["12\" x 12\" Statement Diameter", "Sculpted Lion Head Profile", "Silent Quartz Mechanism", "High-Contrast Dial & Red Needle"]
        },
        {
            id: "wall-clock-roman-scalloped-teak",
            category: "wall-clock",
            categoryName: "Wall Clock",
            title: "Scalloped Geometric Roman Wooden Wall Clock",
            subtitle: "Dual-Tone White & Teak Finish Contemporary Dial",
            specs: "14\" Diameter • Roman Numerals • Teak & White Finish",
            image: "assets/images/wall-clock-roman-scalloped-teak.png",
            description: "Striking 14-inch geometric wall clock featuring an eye-catching scalloped outer frame in crisp white, contrasting rich natural teak wood grain ray inserts with laser-cut Roman numerals and precision silent sweep hands.",
            status: "Available for Order",
            highlights: ["14\" Diameter Statement Clock", "Scalloped Geometric White Rim", "Natural Teak Grain Inserts", "Silent Sweep Quartz Movement"]
        },

        // ================= NIGHT LAMP (3D OPTICAL ILLUSION & AMBIENT GLOWS) =================
        {
            id: "night-lamp-lakshmi-3d",
            category: "night-lamp",
            categoryName: "Night Lamp",
            title: "Goddess Lakshmi 3D LED Sacred Lamp",
            subtitle: "Divine Lotus Acrylic Illusion & Violet Glow",
            specs: "Wall Plug-in • Optical Acrylic • Violet LED",
            image: "assets/images/lakshmi-3d-led-lamp.png",
            description: "Exquisitely etched optical acrylic 3D night light depicting Goddess Lakshmi seated on an auspicious lotus throne with prosperity blessings. Plugs directly into standard wall sockets to radiate a peaceful violet ambient glow in your mandir, bedroom, or living sanctuary.",
            status: "Available for Order",
            highlights: ["3D Optical Illusion", "Sacred Lotus Throne", "Direct Wall Plug-in", "Peaceful Violet Glow"]
        },
        {
            id: "night-lamp-heart-3d",
            category: "night-lamp",
            categoryName: "Night Lamp",
            title: "3D Optical Illusion Heart LED Lamp",
            subtitle: "Romantic Wireframe Mesh & Crimson Tabletop Glow",
            specs: "Tabletop Stand • Crimson Red LED • 3D Illusion",
            image: "assets/images/heart-3d-led-lamp.png",
            description: "Mesmerizing 3D optical illusion desk lamp showcasing an intricately laser-etched geometric wireframe heart on crystal-clear acrylic. Casts an enchanting, romantic crimson-red ambient glow across your bedside, workspace, or living decor.",
            status: "Available for Order",
            highlights: ["3D Wireframe Heart", "Romantic Crimson Glow", "Bedside Tabletop Stand", "Laser-Etched Acrylic"]
        },
        {
            id: "night-lamp-iloveyou-3d",
            category: "night-lamp",
            categoryName: "Night Lamp",
            title: "\"I LOVE YOU\" 3D Wireframe Hearts LED Night Lamp",
            subtitle: "Mesmerizing Optical Illusion Acrylic with Violet Ambient Glow",
            specs: "Wall Plug-in • Laser-Etched Acrylic • Violet/Purple Glow",
            image: "assets/images/night-lamp-iloveyou-3d-hearts.png",
            description: "Enchanting direct wall socket plug-in night light boasting 3 laser-etched geometric 3D wireframe hearts with floating mini hearts and 'I LOVE YOU' typography, casting a serene violet/purple ambient aura.",
            status: "Available for Order",
            highlights: ["3D Wireframe Hearts Illusion", "Direct Wall Socket Plug-in", "Gentle Violet/Purple LED Glow", "Energy Efficient & Low Heat"]
        },


        // ================= WALL HANGING (AUTHENTIC HANDCRAFTED PIECES) =================
        {
            id: "wall-hanging-ganesha-wh006",
            category: "wall-hanging",
            categoryName: "Wall Hanging",
            title: "Lord Ganesha Evil Eye Sacred Wall Hanging",
            subtitle: "Auspicious Nazar Battu & Stained Glass Art",
            specs: "7\" x 18\" (Single) • Stained Glass Medallions • Evil Eye Amulets",
            image: "assets/images/ganesha-evil-eye-hanging.jpg",
            description: "Sacred handcrafted wall hanging uniting Lord Ganesha with protective evil eye amulets in radiant turquoise and royal blue mosaic glass medallion styling.",
            status: "Available for Order",
            highlights: ["7\" x 18\" Size", "Lord Ganesha Art", "Mosaic Glass Medallions", "Auspicious Nazar Battu"]
        },
        {
            id: "wall-hanging-gayatri-mantra",
            category: "wall-hanging",
            categoryName: "Wall Hanging",
            title: "Sacred Gayatri Mantra Wooden Slat Hanging",
            subtitle: "Devanagari Vedic Chants in Multicolored Wooden Plaques",
            specs: "Multi-Tier Wooden Slat • Jute Hanging Rope",
            image: "assets/images/wall-hanging-gayatri-mantra-slats.png",
            description: "Vibrant multi-slat wooden wall hanging featuring the sacred Gayatri Mantra in graceful Hindi Devanagari calligraphy across six colorful weathered wood plaques joined by rustic jute rope.",
            status: "Available for Order",
            highlights: ["Gayatri Mantra Slats", "Devanagari Calligraphy", "Multi-Tier Wooden Plaques", "Positive Vastu Energy"]
        },
        {
            id: "wall-hanging-krishna-mantra",
            category: "wall-hanging",
            categoryName: "Wall Hanging",
            title: "Lord Krishna Mantra Wooden Wall Hanging",
            subtitle: "Sacred Shloka Wooden Panels with Peacock Feather Drops",
            specs: "Multi-Tier Wooden Slats • Sacred Shloka • Jute Rope",
            image: "assets/images/krishna-mantra-wall-hanging.png",
            description: "Exquisite multi-tiered sacred wall hanging featuring Lord Krishna playing his divine flute surrounded by a floral peacock mandala, connected with authentic jute rope to two wooden shloka panels inscribed with Om Krishnaya Vasudevaya and 4 graceful peacock feather drops.",
            status: "Available for Order",
            highlights: ["Lord Krishna Mandala", "Sacred Sanskrit Shlokas", "Peacock Feather Drops", "Jute Rope Wall Hanging"]
        },

        // ================= CAR DASHBOARD DECORE (4 EXCLUSIVE PRODUCTS) =================
        {
            id: "car-dashboard-murugan-acd019",
            category: "car-dashboard",
            categoryName: "Car Dashboard Decore",
            title: "Lord Murugan Acrylic Car Dashboard Frame",
            subtitle: "Divine Kartikeya & Mayur with Sacred Vel",
            specs: "4\" x 3\" (Single) • Beveled Crystal Acrylic • Car Mount",
            image: "assets/images/car-dashboard-murugan-acd019.jpg",
            description: "Crystal-clear beveled acrylic car dashboard frame featuring Lord Murugan (Kartikeya) with his divine peacock and sacred Vel spear. Includes a stable adhesive peel-and-stick base for secure vehicle placement.",
            status: "Available for Order",
            highlights: ["4\" x 3\" Size", "Peel & Stick Car Base", "Lord Murugan Deity", "Beveled Crystal Acrylic"]
        },
        {
            id: "car-dashboard-hanuman-acd004",
            category: "car-dashboard",
            categoryName: "Car Dashboard Decore",
            title: "Lord Hanuman Kneeling Ashirwad Frame",
            subtitle: "3D Sculpted Relief with Gada & Ram Blessing",
            specs: "4\" x 3\" (Single) • Textured 3D Relief • Crystal Acrylic",
            image: "assets/images/car-dashboard-hanuman-acd004.png",
            description: "Intricately detailed sculpted 3D relief depiction of Lord Hanuman kneeling in reverence holding golden Gada with protective blessing hand inscribed with 'Jai Shree Ram', encased in optical crystal acrylic.",
            status: "Available for Order",
            highlights: ["4\" x 3\" Size", "Jai Shree Ram Blessing", "Sculpted Relief Finish", "Crystal Acrylic Frame"]
        },
        {
            id: "car-dashboard-hanuman-acd009",
            category: "car-dashboard",
            categoryName: "Car Dashboard Decore",
            title: "Lord Hanuman Meditating 'RAM' Crimson Frame",
            subtitle: "Serene Dhyan Mudra with Sacred RAM Typography",
            specs: "4\" x 3\" (Single) • Premium Optical Acrylic • Anti-Glare",
            image: "assets/images/car-dashboard-hanuman-acd009.png",
            description: "Striking meditative silhouette of Lord Hanuman seated in deep dhyan posture framed against sacred bold 'RAM' Devanagari typography and a rich glowing crimson red aura.",
            status: "Available for Order",
            highlights: ["4\" x 3\" Size", "Sacred 'RAM' Typography", "Meditative Dhyan Mudra", "Premium Optical Acrylic"]
        },
        {
            id: "car-dashboard-hanuman-acd010",
            category: "car-dashboard",
            categoryName: "Car Dashboard Decore",
            title: "Lord Hanuman Radiant Warrior Acrylic Frame",
            subtitle: "Majestic Veer Hanuman with Golden Gada & Solar Aura",
            specs: "4\" x 3\" (Single) • Crystal Acrylic Stand • Vehicle Mount",
            image: "assets/images/car-dashboard-hanuman-acd010.jpg",
            description: "Majestic depiction of Veer Hanuman standing resolute with his golden Gada weapon amidst a blazing cosmic solar aura, protected in crystal-grade beveled acrylic.",
            status: "Available for Order",
            highlights: ["4\" x 3\" Size", "Cosmic Solar Aura", "Veer Hanuman Energy", "Vehicle Dashboard Mount"]
        },
        {
            id: "car-dashboard-hanuman-acd007",
            category: "car-dashboard",
            categoryName: "Car Dashboard Decore",
            title: "Meditating Lord Hanuman Acrylic Car Dashboard Frame",
            subtitle: "Cosmic Flame Aura & Dhyan Mudra in Beveled Crystal Frame",
            specs: "4\" x 3\" • Crystal Acrylic Frame • Model ACD007",
            image: "assets/images/car-dashboard-hanuman-acd007.jpg",
            description: "Awe-inspiring car dashboard deity frame portraying Lord Hanuman in serene meditative dhyan posture surrounded by a sacred fiery cosmic halo, protected inside an optical crystal-clear acrylic stand with secure dashboard mounting.",
            status: "Available for Order",
            highlights: ["4\" x 3\" Size (ACD007)", "Meditating Hanuman in Dhyan", "Crystal Beveled Acrylic Stand", "Firm Peel & Stick Car Base"]
        },
        {
            id: "car-dashboard-indian-flag-cd019",
            category: "car-dashboard",
            categoryName: "Car Dashboard Decore",
            title: "Patriotic Indian Tiranga & Monuments Car Dashboard Stand",
            subtitle: "Ashoka Chakra, India Gate & Taj Mahal Tricolor Stand",
            specs: "3\" x 4\" • Acrylic & Wood Stand • Model CD019",
            image: "assets/images/car-dashboard-indian-flag-cd019.png",
            description: "Proud patriotic car dashboard ornament highlighting the waving Indian National Flag, Ashoka Chakra, India Gate, and Taj Mahal silhouettes mounted upon an ornate wooden pedestal with bold tricolor 'INDIAN' lettering.",
            status: "Available for Order",
            highlights: ["3\" x 4\" Size (CD019)", "Waving Tiranga & Ashoka Chakra", "India Gate & Taj Mahal Silhouettes", "Carved Wooden Pedestal Base"]
        },
        {
            id: "car-dashboard-shrinathji-cd026",
            category: "car-dashboard",
            categoryName: "Car Dashboard Decore",
            title: "Mere Shrinathji Meri Duniya Car Dashboard Frame",
            subtitle: "Divine Shrinathji Face & Kamadhenu Cows Wooden Stand",
            specs: "4\" x 3\" • Carved Wood Stand • Model CD026",
            image: "assets/images/car-dashboard-shrinathji-cd026.jpg",
            description: "Divine handcrafted car dashboard centerpiece showcasing the sacred countenance of Shrinathji with jewel-encrusted peacock mukut, flanked by auspicious golden Kamadhenu cows on a rich textured oval plaque with 'Mere Shrinathji, Meri Duniya' pedestal base.",
            status: "Available for Order",
            highlights: ["4\" x 3\" Size (CD026)", "Shrinathji Sacred Face & Mukut", "Twin Kamadhenu Holy Cows", "Carved Dark Pedestal Stand"]
        },

        // ================= KEY HOLDER =================
        {
            id: "key-holder-family-birds-kh082",
            category: "key-holder",
            categoryName: "Key Holder",
            title: "\"Family\" Bird Silhouette Wooden Key Holder",
            subtitle: "Charming Twin Birds on Leafy Branch with 6 Metal Key Hooks",
            specs: "6\" x 8\" (kh082) • Engineered Wood & 6 Metal Hooks",
            image: "assets/images/key-holder-family-birds-kh082.png",
            description: "Heartwarming handcrafted wall-mount key organizer featuring graceful twin songbirds perched on a leafy branch above bold 'Family' lettering, fitted with 6 heavy-duty silver ring hooks.",
            status: "Available for Order",
            highlights: ["6\" x 8\" Compact Size (kh082)", "6 Heavy-Duty Metal Key Hooks", "Twin Songbirds Silhouette", "Easy Wall Mounting"]
        },
        {
            id: "key-holder-home-heart-kh083",
            category: "key-holder",
            categoryName: "Key Holder",
            title: "\"Home\" Sweet Heart Silhouette Key Holder",
            subtitle: "House Contour with Heart Window Cutout & 5 Heavy-Duty Hooks",
            specs: "6\" x 8\" (kh083) • Engineered Wood & 5 Metal Hooks",
            image: "assets/images/key-holder-home-heart-kh083.png",
            description: "Charming house-silhouette entryway key organizer showcasing an open heart window and elegant script 'Home' lettering, complete with 5 sturdy curved metal hooks for car keys, house keys, and lanyards.",
            status: "Available for Order",
            highlights: ["6\" x 8\" Dimensions (kh083)", "5 Sturdy Silver Metal Hooks", "Heart & House Silhouette", "Sturdy Wall Flush Mount"]
        }
    ],

    // Metadata for category grouping in Shopping Cart and Order Engine
    categoriesMeta: {
        "wall-clock": {
            id: "wall-clock",
            name: "Wall Clock",
            plural: "Wall Clocks",
            icon: "🕒",
            accentColor: "#C59B3F"
        },
        "key-holder": {
            id: "key-holder",
            name: "Key Holder",
            plural: "Key Holders",
            icon: "🔑",
            accentColor: "#5B7444"
        },
        "night-lamp": {
            id: "night-lamp",
            name: "Night Lamp",
            plural: "Night Lamps",
            icon: "💡",
            accentColor: "#9333EA"
        },
        "wall-decor": {
            id: "wall-decor",
            name: "Wall Decor",
            plural: "Wall Decor",
            icon: "🖼️",
            accentColor: "#B45309"
        },
        "wall-hanging": {
            id: "wall-hanging",
            name: "Wall Hanging",
            plural: "Wall Hangings",
            icon: "🧿",
            accentColor: "#0284C7"
        },
        "car-dashboard": {
            id: "car-dashboard",
            name: "Car Dashboard Decore",
            plural: "Car Dashboard Decore",
            icon: "🚗",
            accentColor: "#D97706"
        }
    },

    // Curated items categorized for shopping cart operations
    defaultCategoryCartProductIds: [
        "wall-clock-roman-scalloped-teak",
        "wall-hanging-krishna-mantra",
        "car-dashboard-hanuman-acd007",
        "car-dashboard-indian-flag-cd019",
        "car-dashboard-shrinathji-cd026"
    ],

    // Admin & Business Notification Settings
    adminConfig: {
        pin: "palora2026", // Secure access PIN for Palora Admin Order Management
        sessionTimeoutMinutes: 60,
        // Optional webhook endpoint for business notifications (e.g. Zapier, Make, Telegram, Discord, Slack, custom webhook)
        notificationWebhookUrl: "",
        enableBrowserNotifications: true
    },

    // Supabase Cloud Backend Configuration (Browser Public Credentials)
    // NOTE: Only use public anon key here. NEVER expose service_role secret key in frontend.
    supabase: {
        url: "https://wirqwmdsvssvjqpjljuv.supabase.co",      // Found in: Supabase Dashboard -> Project Settings -> API -> Project URL
        anonKey: "sb_publishable_4pjBA9MRRpW9Gbl4505Y3w_a7xdycU0"   // Found in: Supabase Dashboard -> Project Settings -> API -> Project API keys -> anon public
    }
};

if (typeof window !== "undefined") {
    window.PALORA_CONFIG = PALORA_CONFIG;
}

