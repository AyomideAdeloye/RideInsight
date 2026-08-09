const vehicleSuggestions = {
    car: [
        "2018 Mazda 6", "2020 Honda Civic", "2021 Toyota Camry",
        "2020 Toyota Corolla", "2019 Honda Accord", "2021 Nissan Altima",
        "2022 Hyundai Elantra", "2021 Kia K5", "2020 Ford Mustang",
        "2021 Dodge Charger", "2020 Chevrolet Camaro", "2021 BMW 3 Series",
        "2020 Mercedes-Benz C-Class", "2021 Audi A4", "2020 Tesla Model 3",
        "2021 Toyota Supra", "2020 Mazda CX-5", "2021 Honda CR-V",
        "2020 Toyota RAV4", "2021 Jeep Wrangler",
        "2020 Mercedes-Benz C-Class", "2021 Mercedes-Benz E-Class", "2020 BMW 3 Series",
        "2021 BMW 5 Series", "2020 Audi A4", "2021 Audi Q5",
        "2020 Volkswagen Golf", "2021 Porsche 911", "2020 Volvo XC60",
        "2021 Land Rover Range Rover", "2020 Lexus IS", "2021 Lexus RX",
        "2020 Jaguar F-Type", "2021 Volkswagen GTI", "2020 BMW X5",
        "2021 Mercedes-Benz GLC", "2020 Audi A6", "2021 BMW M3",
        "2020 Porsche Cayenne", "2021 Mercedes-Benz S-Class"
    ],
    motorcycle: [
        "2021 Kawasaki Ninja 650", "2020 Honda CBR600RR", "2022 Yamaha MT-07",
        "2021 Suzuki GSX-R750", "2020 Ducati Panigale V4", "2022 BMW S1000RR",
        "2021 Harley-Davidson Sportster", "2020 Honda Gold Wing",
        "2022 Kawasaki Z900", "2021 Yamaha R1", "2020 KTM Duke 390",
        "2021 Royal Enfield Meteor 350", "2022 Triumph Street Triple",
        "2020 Honda Africa Twin", "2021 BMW R1250GS",
        "2022 Ducati Monster", "2020 Harley-Davidson Road Glide",
        "2021 Suzuki V-Strom 650", "2022 Yamaha Tenere 700",
        "2021 Honda CB500F"
    ],
    boat: [
        // Bowriders
        "2022 Sea Ray 250 SLX", "2021 Sea Ray 190 SPX", "2020 Sea Ray 210 SPX",
        "2022 Chaparral 21 SSi", "2021 Chaparral 230 SSi", "2020 Chaparral 267 SSX",
        "2022 Bayliner VR5", "2021 Bayliner VR6", "2020 Bayliner Element F18",
        "2022 Regal 26 Express", "2021 Regal 33 Express", "2020 Regal 2300",
        "2022 Cobalt R5", "2021 Cobalt R6", "2020 Cobalt A28",
        "2022 Four Winns H4", "2021 Four Winns H5", "2020 Four Winns H2",
        // Wake / Ski Boats
        "2022 Mastercraft X24", "2021 Mastercraft X22", "2020 Mastercraft NXT22",
        "2022 Malibu Wakesetter 23 LSV", "2021 Malibu 22 MXZ", "2020 Malibu 20 VTX",
        "2022 Nautique G23", "2021 Nautique G21", "2020 Nautique Super Air 230",
        "2022 Centurion Fi23", "2021 Centurion Ri237", "2020 Centurion Ri217",
        "2022 Supra SA550", "2021 Supra SE550", "2020 Supra SL450",
        // Fishing Boats
        "2022 Ranger Z521C", "2021 Ranger Z520L", "2020 Ranger Z519",
        "2022 Tracker Pro Team 195 TXW", "2021 Tracker Pro 170", "2020 Tracker Targa V18",
        "2022 Lund 2075 Pro-V Bass", "2021 Lund 1875 Impact", "2020 Lund 1600 Fury",
        "2022 Nitro Z20", "2021 Nitro Z18", "2020 Nitro Z19",
        "2022 Bass Cat Cougar", "2021 Bass Cat Puma", "2020 Bass Cat Lynx",
        // Pontoon Boats
        "2022 Bennington 22 SSBX", "2021 Bennington 25 RSRX", "2020 Bennington 20 SLX",
        "2022 Sun Tracker Party Barge 22", "2021 Sun Tracker Bass Buggy 18",
        "2022 Manitou Aurora 23", "2021 Manitou Oasis 22", "2020 Manitou Explore 18",
        "2022 Harris Crowne SL 250", "2021 Harris Solstice 250", "2020 Harris Grand Mariner 250",
        // Center Console / Offshore
        "2022 Boston Whaler 270 Vantage", "2021 Boston Whaler 250 Outrage", "2020 Boston Whaler 230 Outrage",
        "2022 Grady-White Freedom 255", "2021 Grady-White Canyon 271", "2020 Grady-White Fisherman 236",
        "2022 Robalo R222", "2021 Robalo R242", "2020 Robalo R207",
        "2022 Mako 21 LTS", "2021 Mako 236 CC", "2020 Mako 184 CC",
        "2022 Sailfish 320 CC", "2021 Sailfish 290 CC", "2020 Sailfish 242 CC",
        // Jet Boats
        "2022 Yamaha 242X E-Series", "2021 Yamaha 212X", "2020 Yamaha 195S",
        "2022 Scarab 195 Open", "2021 Scarab 215 ID", "2020 Scarab 255 Open",
        // Cruisers
        "2022 Cobalt A36", "2021 Cobalt A29", "2020 Cobalt R35",
        "2022 Sea Ray 320 Sundancer", "2021 Sea Ray 350 Coupe", "2020 Sea Ray 400 Sundancer",
    ]
};

// ─── Boat Data ─────────────────────────────────────────────────────
// Full specs for all boats. Matched by make + model substring.
const boatData = [
    // ── Sea Ray ──
    { year:2022, make:"Sea Ray", model:"250 SLX", type:"Bowrider", hull:"fiberglass", length_ft:25, engine_type:"inboard", horsepower:300, fuel_type:"gas", capacity_persons:10, beam_ft:8.5, pros:["Premium build quality","Smooth deep-V hull","Great family comfort"], cons:["High fuel consumption","Premium price tag","Needs large trailer"] },
    { year:2021, make:"Sea Ray", model:"190 SPX", type:"Bowrider", hull:"fiberglass", length_ft:19, engine_type:"sterndrive", horsepower:175, fuel_type:"gas", capacity_persons:8, beam_ft:7.5, pros:["Affordable Sea Ray entry point","Easy to tow","Good for day trips"], cons:["Smaller capacity","Less powerful","Basic amenities"] },
    { year:2020, make:"Sea Ray", model:"210 SPX", type:"Bowrider", hull:"fiberglass", length_ft:21, engine_type:"sterndrive", horsepower:200, fuel_type:"gas", capacity_persons:9, beam_ft:7.8, pros:["Good mid-size option","Comfortable seating","Reliable sterndrive"], cons:["Sterndrive maintenance costs","Limited storage","Not offshore capable"] },
    { year:2022, make:"Sea Ray", model:"320 Sundancer", type:"Cruiser", hull:"fiberglass", length_ft:32, engine_type:"inboard", horsepower:400, fuel_type:"gas", capacity_persons:8, beam_ft:10.5, pros:["Overnight capable cabin","Spacious deck","Premium finishes"], cons:["Very expensive","High running costs","Needs slip or large trailer"] },
    // ── Chaparral ──
    { year:2022, make:"Chaparral", model:"21 SSi", type:"Bowrider", hull:"fiberglass", length_ft:21, engine_type:"sterndrive", horsepower:220, fuel_type:"gas", capacity_persons:8, beam_ft:8.0, pros:["Compact and easy to tow","Good fuel economy","Versatile"], cons:["Sterndrive maintenance","Smaller size limits offshore use","Less powerful than larger"] },
    { year:2021, make:"Chaparral", model:"230 SSi", type:"Bowrider", hull:"fiberglass", length_ft:23, engine_type:"sterndrive", horsepower:260, fuel_type:"gas", capacity_persons:10, beam_ft:8.5, pros:["Spacious for size","Quality construction","Smooth ride"], cons:["Premium pricing","Sterndrive service costs","Heavier to tow"] },
    { year:2020, make:"Chaparral", model:"267 SSX", type:"Bowrider", hull:"fiberglass", length_ft:27, engine_type:"inboard", horsepower:350, fuel_type:"gas", capacity_persons:12, beam_ft:9.0, pros:["Large family capacity","Offshore capable","Luxurious finish"], cons:["Expensive","High fuel use","Requires powerful tow vehicle"] },
    // ── Bayliner ──
    { year:2022, make:"Bayliner", model:"VR5", type:"Bowrider", hull:"fiberglass", length_ft:19, engine_type:"sterndrive", horsepower:135, fuel_type:"gas", capacity_persons:7, beam_ft:7.5, pros:["Affordable entry-level","Easy to tow","Good for beginners"], cons:["Less powerful","Basic features","Smaller capacity"] },
    { year:2021, make:"Bayliner", model:"VR6", type:"Bowrider", hull:"fiberglass", length_ft:21, engine_type:"sterndrive", horsepower:175, fuel_type:"gas", capacity_persons:9, beam_ft:8.0, pros:["Good value","Comfortable layout","Reliable engine"], cons:["Not for offshore","Basic interior","Sterndrive upkeep"] },
    { year:2020, make:"Bayliner", model:"Element F18", type:"Bowrider", hull:"fiberglass", length_ft:18, engine_type:"outboard", horsepower:115, fuel_type:"gas", capacity_persons:7, beam_ft:7.5, pros:["Very affordable","Easy to handle","Outboard simplicity"], cons:["Very basic","Limited speed","Minimal features"] },
    // ── Mastercraft ──
    { year:2022, make:"Mastercraft", model:"X24", type:"Wake Boat", hull:"fiberglass", length_ft:24, engine_type:"inboard", horsepower:450, fuel_type:"gas", capacity_persons:16, beam_ft:8.5, pros:["Massive wake","Premium sound system","High capacity"], cons:["Very expensive","High fuel use","Overkill for casual use"] },
    { year:2021, make:"Mastercraft", model:"X22", type:"Wake Boat", hull:"fiberglass", length_ft:22, engine_type:"inboard", horsepower:400, fuel_type:"gas", capacity_persons:14, beam_ft:8.5, pros:["Great wake shaping","Spacious","Solid resale value"], cons:["Expensive","Heavy fuel consumption","Inboard maintenance"] },
    { year:2020, make:"Mastercraft", model:"NXT22", type:"Wake Boat", hull:"fiberglass", length_ft:22, engine_type:"inboard", horsepower:350, fuel_type:"gas", capacity_persons:14, beam_ft:8.5, pros:["More affordable Mastercraft","Good wake","Family friendly"], cons:["Still expensive","High fuel","Less features than X series"] },
    // ── Malibu ──
    { year:2022, make:"Malibu", model:"Wakesetter 23 LSV", type:"Wake Boat", hull:"fiberglass", length_ft:23, engine_type:"inboard", horsepower:350, fuel_type:"gas", capacity_persons:14, beam_ft:8.5, pros:["Excellent wake tech","Spacious interior","Great ballast"], cons:["High cost","Heavy fuel use","Inboard upkeep"] },
    { year:2021, make:"Malibu", model:"22 MXZ", type:"Wake Boat", hull:"fiberglass", length_ft:22, engine_type:"inboard", horsepower:325, fuel_type:"gas", capacity_persons:13, beam_ft:8.5, pros:["Versatile wake/surf","Quality build","Good resale"], cons:["Expensive","Fuel hungry","Needs dock or trailer"] },
    // ── Ranger ──
    { year:2022, make:"Ranger", model:"Z521C", type:"Bass Boat", hull:"fiberglass", length_ft:21, engine_type:"outboard", horsepower:250, fuel_type:"gas", capacity_persons:3, beam_ft:8.0, pros:["Extremely fast","Tournament-grade features","Low profile for fishing"], cons:["Not family-friendly","Very low to water","Expensive for fishing boat"] },
    { year:2021, make:"Ranger", model:"Z520L", type:"Bass Boat", hull:"fiberglass", length_ft:20, engine_type:"outboard", horsepower:225, fuel_type:"gas", capacity_persons:3, beam_ft:7.8, pros:["Fast and agile","Well equipped for fishing","Good fit and finish"], cons:["Single-purpose design","Limited passenger room","No casual use"] },
    // ── Tracker ──
    { year:2022, make:"Tracker", model:"Pro Team 195 TXW", type:"Bass Boat", hull:"aluminum", length_ft:19, engine_type:"outboard", horsepower:115, fuel_type:"gas", capacity_persons:4, beam_ft:7.8, pros:["Affordable aluminum build","Good fishing setup","Easy to tow"], cons:["Rougher ride","Basic finish","Limited top speed"] },
    { year:2021, make:"Tracker", model:"Pro 170", type:"Bass Boat", hull:"aluminum", length_ft:17, engine_type:"outboard", horsepower:75, fuel_type:"gas", capacity_persons:3, beam_ft:7.0, pros:["Very affordable","Great entry-level fishing boat","Lightweight"], cons:["Basic features","Small capacity","Not for large lakes"] },
    // ── Lund ──
    { year:2022, make:"Lund", model:"2075 Pro-V Bass", type:"Bass Boat", hull:"aluminum", length_ft:20, engine_type:"outboard", horsepower:200, fuel_type:"gas", capacity_persons:3, beam_ft:8.0, pros:["Durable aluminum","Good value vs fiberglass","Excellent for inland lakes"], cons:["Rougher ride","Less refined","Not ideal for large waves"] },
    { year:2021, make:"Lund", model:"1875 Impact", type:"Multi-Species", hull:"aluminum", length_ft:18, engine_type:"outboard", horsepower:115, fuel_type:"gas", capacity_persons:5, beam_ft:7.8, pros:["Versatile fishing layout","Solid aluminum build","Good value"], cons:["Not a dedicated bass boat","Moderate speed","Basic amenities"] },
    // ── Boston Whaler ──
    { year:2022, make:"Boston Whaler", model:"270 Vantage", type:"Cruiser", hull:"unsinkable foam-filled", length_ft:27, engine_type:"outboard", horsepower:400, fuel_type:"gas", capacity_persons:10, beam_ft:9.5, pros:["Legendary unsinkable hull","Excellent offshore stability","High resale value"], cons:["Very expensive","Large footprint","Heavy to trailer"] },
    { year:2021, make:"Boston Whaler", model:"250 Outrage", type:"Center Console", hull:"unsinkable foam-filled", length_ft:25, engine_type:"outboard", horsepower:350, fuel_type:"gas", capacity_persons:10, beam_ft:9.0, pros:["Legendary safety","Offshore capable","Premium quality"], cons:["Expensive","Heavy","Requires large tow vehicle"] },
    { year:2020, make:"Boston Whaler", model:"230 Outrage", type:"Center Console", hull:"unsinkable foam-filled", length_ft:23, engine_type:"outboard", horsepower:300, fuel_type:"gas", capacity_persons:8, beam_ft:8.5, pros:["Iconic unsinkable design","Great rough water handling","Strong resale"], cons:["High price","Heavy for size","Pricey to run"] },
    // ── Grady-White ──
    { year:2022, make:"Grady-White", model:"Freedom 255", type:"Dual Console", hull:"fiberglass", length_ft:25, engine_type:"outboard", horsepower:300, fuel_type:"gas", capacity_persons:8, beam_ft:8.6, pros:["Excellent rough water performance","Quality build","High resale"], cons:["Premium price","Heavy","Powerful tow vehicle needed"] },
    { year:2021, make:"Grady-White", model:"Canyon 271", type:"Center Console", hull:"fiberglass", length_ft:27, engine_type:"outboard", horsepower:400, fuel_type:"gas", capacity_persons:8, beam_ft:9.5, pros:["Offshore capable","Premium fishing features","Exceptional build"], cons:["Very expensive","High running costs","Large footprint"] },
    // ── Yamaha ──
    { year:2022, make:"Yamaha", model:"242X E-Series", type:"Jet Boat", hull:"fiberglass", length_ft:24, engine_type:"jet", horsepower:180, fuel_type:"gas", capacity_persons:9, beam_ft:8.5, pros:["No propeller — safer for swimmers","Sporty handling","Reliable engines"], cons:["Less efficient at low speed","Limited cargo","Less fuel-efficient than outboard"] },
    { year:2021, make:"Yamaha", model:"212X", type:"Jet Boat", hull:"fiberglass", length_ft:21, engine_type:"jet", horsepower:180, fuel_type:"gas", capacity_persons:8, beam_ft:8.5, pros:["Fun sporty ride","Prop-free safety","Yamaha reliability"], cons:["Thirsty at low speeds","Limited storage","Trailering can be tricky"] },
    { year:2020, make:"Yamaha", model:"195S", type:"Jet Boat", hull:"fiberglass", length_ft:19, engine_type:"jet", horsepower:110, fuel_type:"gas", capacity_persons:7, beam_ft:7.8, pros:["Affordable jet boat entry","Easy to handle","Good for families"], cons:["Less powerful","Not for offshore","Fuel inefficient"] },
    // ── Scarab ──
    { year:2022, make:"Scarab", model:"195 Open", type:"Jet Boat", hull:"fiberglass", length_ft:19, engine_type:"jet", horsepower:150, fuel_type:"gas", capacity_persons:8, beam_ft:7.8, pros:["Affordable jet boat","Fun sporty styling","Good for watersports"], cons:["Thirsty","Limited storage","Not offshore capable"] },
    { year:2021, make:"Scarab", model:"215 ID", type:"Jet Boat", hull:"fiberglass", length_ft:21, engine_type:"jet", horsepower:175, fuel_type:"gas", capacity_persons:9, beam_ft:8.0, pros:["Intelligent debris system","Sporty performance","Good watersports"], cons:["Premium jet boat price","Fuel thirsty","Service network smaller than Yamaha"] },
    // ── Bennington ──
    { year:2022, make:"Bennington", model:"22 SSBX", type:"Pontoon", hull:"aluminum", length_ft:22, engine_type:"outboard", horsepower:115, fuel_type:"gas", capacity_persons:11, beam_ft:8.5, pros:["Premium pontoon brand","Comfortable for entertaining","Good fuel economy"], cons:["Not built for speed","Rough water handling limited","Needs wide trailer"] },
    { year:2021, make:"Bennington", model:"25 RSRX", type:"Pontoon", hull:"aluminum", length_ft:25, engine_type:"outboard", horsepower:200, fuel_type:"gas", capacity_persons:14, beam_ft:8.5, pros:["Large capacity","Luxury amenities","Great for entertaining"], cons:["Expensive pontoon","Slow in rough water","Large storage requirement"] },
    // ── Nitro ──
    { year:2022, make:"Nitro", model:"Z20", type:"Bass Boat", hull:"fiberglass", length_ft:20, engine_type:"outboard", horsepower:200, fuel_type:"gas", capacity_persons:3, beam_ft:8.0, pros:["Fast tournament-ready boat","Great value in fiberglass bass","Well-equipped"], cons:["Single purpose","Rough in choppy water","Not for casual use"] },
    { year:2021, make:"Nitro", model:"Z18", type:"Bass Boat", hull:"fiberglass", length_ft:18, engine_type:"outboard", horsepower:150, fuel_type:"gas", capacity_persons:3, beam_ft:7.5, pros:["Affordable fiberglass bass boat","Quick and agile","Good fishing features"], cons:["Small capacity","Basic amenities","Not a family boat"] },
    // ── Sailfish ──
    { year:2022, make:"Sailfish", model:"320 CC", type:"Center Console", hull:"fiberglass", length_ft:32, engine_type:"outboard", horsepower:600, fuel_type:"gas", capacity_persons:10, beam_ft:10.5, pros:["Serious offshore capability","Triple engine power","Premium fishing setup"], cons:["Very expensive","Massive fuel consumption","Needs marina slip"] },
    { year:2021, make:"Sailfish", model:"290 CC", type:"Center Console", hull:"fiberglass", length_ft:29, engine_type:"outboard", horsepower:450, fuel_type:"gas", capacity_persons:9, beam_ft:9.5, pros:["Offshore capable","Great build quality","Good fishing features"], cons:["Expensive","High fuel costs","Needs large trailer or slip"] },
    // ── Cobalt ──
    { year:2022, make:"Cobalt", model:"R5", type:"Bowrider", hull:"fiberglass", length_ft:20, engine_type:"sterndrive", horsepower:200, fuel_type:"gas", capacity_persons:8, beam_ft:7.8, pros:["Premium fit and finish","Sporty performance","Good resale value"], cons:["Sterndrive maintenance","Premium pricing","Limited storage"] },
    { year:2021, make:"Cobalt", model:"R6", type:"Bowrider", hull:"fiberglass", length_ft:21, engine_type:"sterndrive", horsepower:220, fuel_type:"gas", capacity_persons:9, beam_ft:8.0, pros:["Excellent build quality","Comfortable layout","Strong brand reputation"], cons:["Expensive for size","Sterndrive upkeep","Heavier than comparable boats"] },
    { year:2022, make:"Cobalt", model:"A36", type:"Cruiser", hull:"fiberglass", length_ft:36, engine_type:"inboard", horsepower:500, fuel_type:"gas", capacity_persons:10, beam_ft:11.0, pros:["Overnight capable","Luxurious interior","Excellent craftsmanship"], cons:["Very expensive","High running costs","Needs marina slip"] },
    // ── Robalo ──
    { year:2022, make:"Robalo", model:"R222", type:"Center Console", hull:"fiberglass", length_ft:22, engine_type:"outboard", horsepower:200, fuel_type:"gas", capacity_persons:8, beam_ft:8.5, pros:["Versatile center console","Good value","Reliable outboard setup"], cons:["Not offshore rated","Basic amenities","Moderate speed"] },
    { year:2021, make:"Robalo", model:"R242", type:"Center Console", hull:"fiberglass", length_ft:24, engine_type:"outboard", horsepower:250, fuel_type:"gas", capacity_persons:9, beam_ft:8.6, pros:["Offshore capable","Solid construction","Good fishing layout"], cons:["Premium price","High fuel use","Heavy to tow"] },
    // ── Mako ──
    { year:2022, make:"Mako", model:"21 LTS", type:"Center Console", hull:"fiberglass", length_ft:21, engine_type:"outboard", horsepower:150, fuel_type:"gas", capacity_persons:8, beam_ft:8.0, pros:["Affordable center console","Good for inshore fishing","Easy to handle"], cons:["Not offshore capable","Basic features","Limited storage"] },
    { year:2021, make:"Mako", model:"236 CC", type:"Center Console", hull:"fiberglass", length_ft:23, engine_type:"outboard", horsepower:250, fuel_type:"gas", capacity_persons:9, beam_ft:8.5, pros:["Offshore capable","Serious fishing features","Good rough water handling"], cons:["Expensive","Fuel hungry","Needs strong tow vehicle"] },
    // ── Nautique ──
    { year:2022, make:"Nautique", model:"G23", type:"Wake Boat", hull:"fiberglass", length_ft:23, engine_type:"inboard", horsepower:450, fuel_type:"gas", capacity_persons:15, beam_ft:8.5, pros:["Elite wake/surf boat","Tournament proven","Premium build"], cons:["Extremely expensive","High fuel use","Overkill for casual use"] },
    { year:2021, make:"Nautique", model:"G21", type:"Wake Boat", hull:"fiberglass", length_ft:21, engine_type:"inboard", horsepower:400, fuel_type:"gas", capacity_persons:14, beam_ft:8.5, pros:["World-class wake shaping","Premium quality","Great resale"], cons:["Very expensive","Fuel intensive","Dedicated wake use only"] },
    // ── Supra ──
    { year:2022, make:"Supra", model:"SA550", type:"Wake Boat", hull:"fiberglass", length_ft:22, engine_type:"inboard", horsepower:550, fuel_type:"gas", capacity_persons:15, beam_ft:8.5, pros:["Massive power for wake","Premium sound system","Spacious"], cons:["Very expensive","High fuel consumption","Heavy boat"] },
    // ── Centurion ──
    { year:2022, make:"Centurion", model:"Fi23", type:"Wake Boat", hull:"fiberglass", length_ft:23, engine_type:"inboard", horsepower:400, fuel_type:"gas", capacity_persons:14, beam_ft:8.5, pros:["Excellent wake tech","Fuel injection efficiency","Premium build"], cons:["Expensive","Inboard maintenance","High fuel use"] },
    // ── Harris ──
    { year:2022, make:"Harris", model:"Crowne SL 250", type:"Pontoon", hull:"aluminum", length_ft:25, engine_type:"outboard", horsepower:150, fuel_type:"gas", capacity_persons:14, beam_ft:8.5, pros:["Premium pontoon quality","Comfortable for groups","Good stability"], cons:["Not sporty","Slow in waves","Wide trailer needed"] },
    // ── Manitou ──
    { year:2022, make:"Manitou", model:"Aurora 23", type:"Pontoon", hull:"aluminum", length_ft:23, engine_type:"outboard", horsepower:115, fuel_type:"gas", capacity_persons:12, beam_ft:8.5, pros:["Good value pontoon","Comfortable layout","Reliable"], cons:["Not built for speed","Wave handling limited","Basic features"] },
    // ── Sun Tracker ──
    { year:2022, make:"Sun Tracker", model:"Party Barge 22", type:"Pontoon", hull:"aluminum", length_ft:22, engine_type:"outboard", horsepower:90, fuel_type:"gas", capacity_persons:12, beam_ft:8.5, pros:["Very affordable pontoon","Great for entertaining","Easy to operate"], cons:["Not sporty","Limited speed","Basic build quality"] },
    { year:2021, make:"Sun Tracker", model:"Bass Buggy 18", type:"Pontoon", hull:"aluminum", length_ft:18, engine_type:"outboard", horsepower:60, fuel_type:"gas", capacity_persons:8, beam_ft:7.5, pros:["Very affordable","Fishing-friendly layout","Easy to tow"], cons:["Very slow","Basic build","Limited to calm water"] },
    // ── Regal ──
    { year:2022, make:"Regal", model:"26 Express", type:"Cruiser", hull:"fiberglass", length_ft:26, engine_type:"sterndrive", horsepower:300, fuel_type:"gas", capacity_persons:9, beam_ft:9.0, pros:["Overnight capable","Quality construction","Versatile use"], cons:["Sterndrive upkeep","Expensive","Needs slip or large trailer"] },
];

// Search function used by compare.js
function searchBoatData(make, model) {
    if (!make) return null;
    const ml = make.toLowerCase().trim();
    const mo = (model || "").toLowerCase().trim();

    // 1. Exact make + exact model
    let m = boatData.find(b => b.make.toLowerCase() === ml && b.model.toLowerCase() === mo);
    if (m) return m;

    // 2. Exact make + model contains search
    m = boatData.find(b => b.make.toLowerCase() === ml && b.model.toLowerCase().includes(mo));
    if (m) return m;

    // 3. Make contains + model contains
    m = boatData.find(b => b.make.toLowerCase().includes(ml) && b.model.toLowerCase().includes(mo));
    if (m) return m;

    // 4. Search contains make + search contains model (handles "sea ray 250 slx" -> make="sea", model="ray 250 slx")
    const combined = (ml + " " + mo).trim();
    m = boatData.find(b => {
        const bMake  = b.make.toLowerCase();
        const bModel = b.model.toLowerCase();
        return combined.includes(bMake) && combined.includes(bModel.split(" ")[0]);
    });
    if (m) return m;

    // 5. Any boat whose make+model words all appear in the combined search string
    m = boatData.find(b => {
        const words = (b.make + " " + b.model).toLowerCase().split(" ");
        return words.every(w => w.length > 2 && combined.includes(w));
    });
    return m || null;
}

// ─── Local Motorcycle Specs ────────────────────────────────────────
// Fallback when API Ninjas returns incomplete/no data
const motoData = [
    // ── Honda ──
    { make:"Honda", model:"Rebel 1100", type:"Cruiser", displacement:"1084", engine:"Parallel Twin SOHC", power:"87 HP @ 7,000 RPM", torque:"98 Nm @ 4,750 RPM", weight_kg:221 },
    { make:"Honda", model:"Rebel 500",  type:"Cruiser", displacement:"471",  engine:"Parallel Twin DOHC", power:"45 HP @ 8,500 RPM", torque:"43 Nm @ 6,000 RPM", weight_kg:189 },
    { make:"Honda", model:"Rebel 300",  type:"Cruiser", displacement:"286",  engine:"Single Cylinder DOHC", power:"27 HP @ 8,500 RPM", torque:"25 Nm @ 6,000 RPM", weight_kg:168 },
    { make:"Honda", model:"CB650R",     type:"Naked",   displacement:"649",  engine:"Inline 4 DOHC", power:"92 HP @ 12,000 RPM", torque:"64 Nm @ 8,500 RPM", weight_kg:202 },
    { make:"Honda", model:"CBR650R",    type:"Sport",   displacement:"649",  engine:"Inline 4 DOHC", power:"92 HP @ 12,000 RPM", torque:"64 Nm @ 8,500 RPM", weight_kg:204 },
    { make:"Honda", model:"CB500F",     type:"Naked",   displacement:"471",  engine:"Parallel Twin DOHC", power:"47 HP @ 8,600 RPM", torque:"43 Nm @ 6,500 RPM", weight_kg:189 },
    { make:"Honda", model:"Africa Twin",type:"Adventure",displacement:"1084",engine:"Parallel Twin DOHC", power:"102 HP @ 7,500 RPM", torque:"105 Nm @ 6,250 RPM", weight_kg:226 },
    { make:"Honda", model:"Gold Wing",  type:"Touring", displacement:"1833", engine:"Flat Six DOHC", power:"93 HP @ 5,500 RPM", torque:"170 Nm @ 4,500 RPM", weight_kg:390 },

    // ── Kawasaki ──
    { make:"Kawasaki", model:"Ninja 650",    type:"Sport",   displacement:"649",  engine:"Parallel Twin DOHC", power:"67 HP @ 8,000 RPM", torque:"65 Nm @ 6,700 RPM", weight_kg:193 },
    { make:"Kawasaki", model:"Ninja 400",    type:"Sport",   displacement:"399",  engine:"Parallel Twin DOHC", power:"45 HP @ 10,000 RPM", torque:"38 Nm @ 8,000 RPM", weight_kg:167 },
    { make:"Kawasaki", model:"Z900",         type:"Naked",   displacement:"948",  engine:"Inline 4 DOHC", power:"125 HP @ 9,500 RPM", torque:"98 Nm @ 7,700 RPM", weight_kg:210 },
    { make:"Kawasaki", model:"Z650",         type:"Naked",   displacement:"649",  engine:"Parallel Twin DOHC", power:"67 HP @ 8,000 RPM", torque:"65 Nm @ 6,700 RPM", weight_kg:187 },
    { make:"Kawasaki", model:"Ninja ZX-6R",  type:"Sport",   displacement:"636",  engine:"Inline 4 DOHC", power:"130 HP @ 13,500 RPM", torque:"70 Nm @ 11,000 RPM", weight_kg:196 },
    { make:"Kawasaki", model:"Ninja ZX-10R", type:"Sport",   displacement:"998",  engine:"Inline 4 DOHC", power:"203 HP @ 13,200 RPM", torque:"114 Nm @ 11,400 RPM", weight_kg:207 },
    { make:"Kawasaki", model:"Vulcan S",     type:"Cruiser", displacement:"649",  engine:"Parallel Twin DOHC", power:"61 HP @ 7,500 RPM", torque:"64 Nm @ 6,600 RPM", weight_kg:228 },
    { make:"Kawasaki", model:"Versys 650",   type:"Adventure",displacement:"649", engine:"Parallel Twin DOHC", power:"67 HP @ 8,500 RPM", torque:"64 Nm @ 7,000 RPM", weight_kg:217 },

    // ── Yamaha ──
    { make:"Yamaha", model:"MT-07",     type:"Naked",   displacement:"689",  engine:"CP2 Parallel Twin", power:"73 HP @ 9,000 RPM", torque:"68 Nm @ 6,500 RPM", weight_kg:184 },
    { make:"Yamaha", model:"MT-09",     type:"Naked",   displacement:"890",  engine:"CP3 Triple", power:"119 HP @ 10,000 RPM", torque:"93 Nm @ 7,000 RPM", weight_kg:193 },
    { make:"Yamaha", model:"YZF-R7",    type:"Sport",   displacement:"689",  engine:"CP2 Parallel Twin", power:"73 HP @ 8,750 RPM", torque:"67 Nm @ 6,500 RPM", weight_kg:188 },
    { make:"Yamaha", model:"YZF-R3",    type:"Sport",   displacement:"321",  engine:"Parallel Twin DOHC", power:"42 HP @ 12,000 RPM", torque:"29 Nm @ 9,000 RPM", weight_kg:169 },
    { make:"Yamaha", model:"YZF-R6",    type:"Sport",   displacement:"599",  engine:"Inline 4 DOHC", power:"117 HP @ 14,500 RPM", torque:"65 Nm @ 10,500 RPM", weight_kg:190 },
    { make:"Yamaha", model:"Tenere 700",type:"Adventure",displacement:"689", engine:"CP2 Parallel Twin", power:"72 HP @ 9,000 RPM", torque:"68 Nm @ 6,500 RPM", weight_kg:204 },
    { make:"Yamaha", model:"V-Star 250",type:"Cruiser", displacement:"249",  engine:"Single Cylinder OHC", power:"21 HP @ 8,000 RPM", torque:"19 Nm @ 6,000 RPM", weight_kg:152 },
    { make:"Yamaha", model:"Bolt",      type:"Cruiser", displacement:"942",  engine:"V-Twin OHV", power:"54 HP @ 5,500 RPM", torque:"80 Nm @ 3,000 RPM", weight_kg:247 },

    // ── Harley-Davidson ──
    { make:"Harley-Davidson", model:"Super Glide",   type:"Cruiser", displacement:"1450", engine:"Twin Cam 88 V-Twin", power:"68 HP @ 5,200 RPM", torque:"111 Nm @ 3,000 RPM", weight_kg:295 },
    { make:"Harley-Davidson", model:"Street Glide",  type:"Touring", displacement:"1868", engine:"Milwaukee-Eight V-Twin", power:"90 HP @ 5,020 RPM", torque:"155 Nm @ 3,000 RPM", weight_kg:380 },
    { make:"Harley-Davidson", model:"Road Glide",    type:"Touring", displacement:"1868", engine:"Milwaukee-Eight V-Twin", power:"90 HP @ 5,020 RPM", torque:"155 Nm @ 3,000 RPM", weight_kg:387 },
    { make:"Harley-Davidson", model:"Fat Boy",       type:"Cruiser", displacement:"1868", engine:"Milwaukee-Eight V-Twin", power:"90 HP @ 5,020 RPM", torque:"155 Nm @ 3,000 RPM", weight_kg:317 },
    { make:"Harley-Davidson", model:"Sportster S",   type:"Cruiser", displacement:"1252", engine:"Revolution Max V-Twin", power:"121 HP @ 7,500 RPM", torque:"127 Nm @ 6,000 RPM", weight_kg:228 },
    { make:"Harley-Davidson", model:"Iron 883",      type:"Cruiser", displacement:"883",  engine:"Evolution V-Twin", power:"50 HP @ 6,500 RPM", torque:"68 Nm @ 3,750 RPM", weight_kg:258 },
    { make:"Harley-Davidson", model:"Breakout",      type:"Cruiser", displacement:"1868", engine:"Milwaukee-Eight V-Twin", power:"90 HP @ 5,020 RPM", torque:"155 Nm @ 3,000 RPM", weight_kg:306 },
    { make:"Harley-Davidson", model:"Softail Standard",type:"Cruiser",displacement:"1868",engine:"Milwaukee-Eight V-Twin", power:"90 HP @ 5,020 RPM", torque:"155 Nm @ 3,000 RPM", weight_kg:286 },
    { make:"Harley-Davidson", model:"Low Rider S",   type:"Cruiser", displacement:"1923", engine:"Milwaukee-Eight 117 V-Twin", power:"100 HP @ 5,020 RPM", torque:"163 Nm @ 3,250 RPM", weight_kg:305 },
    { make:"Harley-Davidson", model:"Pan America",   type:"Adventure",displacement:"1252",engine:"Revolution Max V-Twin", power:"150 HP @ 9,000 RPM", torque:"128 Nm @ 6,750 RPM", weight_kg:245 },

    // ── Ducati ──
    { make:"Ducati", model:"Monster",        type:"Naked",   displacement:"937",  engine:"Testastretta V2", power:"111 HP @ 9,250 RPM", torque:"93 Nm @ 6,500 RPM", weight_kg:166 },
    { make:"Ducati", model:"Panigale V4",    type:"Sport",   displacement:"1103", engine:"Desmosedici Stradale V4", power:"214 HP @ 13,000 RPM", torque:"124 Nm @ 9,500 RPM", weight_kg:175 },
    { make:"Ducati", model:"Panigale V2",    type:"Sport",   displacement:"955",  engine:"Superquadro V2", power:"155 HP @ 10,750 RPM", torque:"104 Nm @ 9,000 RPM", weight_kg:176 },
    { make:"Ducati", model:"Multistrada V4", type:"Adventure",displacement:"1158",engine:"Granturismo V4", power:"170 HP @ 10,500 RPM", torque:"125 Nm @ 8,750 RPM", weight_kg:243 },
    { make:"Ducati", model:"Scrambler 800",  type:"Naked",   displacement:"803",  engine:"L-Twin Desmodue", power:"73 HP @ 8,250 RPM", torque:"67 Nm @ 5,750 RPM", weight_kg:184 },

    // ── BMW ──
    { make:"BMW", model:"R 1250 GS",   type:"Adventure", displacement:"1254", engine:"Boxer Twin ShiftCam", power:"136 HP @ 7,750 RPM", torque:"143 Nm @ 6,250 RPM", weight_kg:249 },
    { make:"BMW", model:"S 1000 RR",   type:"Sport",     displacement:"999",  engine:"Inline 4 DOHC", power:"210 HP @ 13,500 RPM", torque:"113 Nm @ 11,000 RPM", weight_kg:197 },
    { make:"BMW", model:"F 900 R",     type:"Naked",     displacement:"895",  engine:"Parallel Twin DOHC", power:"105 HP @ 8,750 RPM", torque:"92 Nm @ 6,750 RPM", weight_kg:211 },
    { make:"BMW", model:"F 900 XR",    type:"Adventure", displacement:"895",  engine:"Parallel Twin DOHC", power:"105 HP @ 8,750 RPM", torque:"92 Nm @ 6,750 RPM", weight_kg:219 },
    { make:"BMW", model:"G 310 R",     type:"Naked",     displacement:"313",  engine:"Single Cylinder DOHC", power:"34 HP @ 9,500 RPM", torque:"28 Nm @ 7,500 RPM", weight_kg:158 },

    // ── Triumph ──
    { make:"Triumph", model:"Street Triple R",   type:"Naked",     displacement:"765", engine:"Inline Triple DOHC", power:"118 HP @ 12,000 RPM", torque:"77 Nm @ 9,400 RPM", weight_kg:166 },
    { make:"Triumph", model:"Tiger 900",         type:"Adventure", displacement:"888", engine:"Inline Triple DOHC", power:"95 HP @ 8,750 RPM",  torque:"87 Nm @ 7,250 RPM", weight_kg:193 },
    { make:"Triumph", model:"Bonneville T120",   type:"Cruiser",   displacement:"1200",engine:"Parallel Twin HT", power:"80 HP @ 6,550 RPM", torque:"105 Nm @ 3,500 RPM", weight_kg:228 },
    { make:"Triumph", model:"Trident 660",       type:"Naked",     displacement:"660", engine:"Inline Triple DOHC", power:"81 HP @ 10,250 RPM", torque:"64 Nm @ 6,250 RPM", weight_kg:189 },

    // ── Suzuki ──
    { make:"Suzuki", model:"SV650",      type:"Naked",   displacement:"645", engine:"V-Twin DOHC", power:"75 HP @ 8,500 RPM", torque:"64 Nm @ 6,800 RPM", weight_kg:197 },
    { make:"Suzuki", model:"V-Strom 650",type:"Adventure",displacement:"645",engine:"V-Twin DOHC", power:"71 HP @ 8,800 RPM", torque:"62 Nm @ 6,500 RPM", weight_kg:216 },
    { make:"Suzuki", model:"GSX-R600",   type:"Sport",   displacement:"599", engine:"Inline 4 DOHC", power:"124 HP @ 13,000 RPM", torque:"66 Nm @ 11,000 RPM", weight_kg:164 },
    { make:"Suzuki", model:"GSX-R750",   type:"Sport",   displacement:"750", engine:"Inline 4 DOHC", power:"148 HP @ 14,000 RPM", torque:"85 Nm @ 11,200 RPM", weight_kg:167 },

    // ── KTM ──
    { make:"KTM", model:"Duke 390",         type:"Naked",   displacement:"373",  engine:"Single Cylinder DOHC", power:"44 HP @ 9,000 RPM", torque:"37 Nm @ 7,000 RPM", weight_kg:163 },
    { make:"KTM", model:"890 Duke",         type:"Naked",   displacement:"889",  engine:"Parallel Twin DOHC", power:"115 HP @ 9,000 RPM", torque:"100 Nm @ 7,000 RPM", weight_kg:166 },
    { make:"KTM", model:"1290 Super Duke R",type:"Naked",   displacement:"1301", engine:"V-Twin DOHC", power:"180 HP @ 9,500 RPM", torque:"140 Nm @ 7,000 RPM", weight_kg:189 },
    { make:"KTM", model:"790 Adventure",    type:"Adventure",displacement:"799", engine:"Parallel Twin DOHC", power:"95 HP @ 8,000 RPM", torque:"88 Nm @ 6,500 RPM", weight_kg:189 },
    { make:"KTM", model:"RC 390",           type:"Sport",   displacement:"373",  engine:"Single Cylinder DOHC", power:"44 HP @ 9,000 RPM", torque:"37 Nm @ 7,000 RPM", weight_kg:163 },

    // ── Royal Enfield ──
    { make:"Royal Enfield", model:"Classic 350", type:"Cruiser", displacement:"349", engine:"J-platform Single Cylinder", power:"20 HP @ 6,100 RPM", torque:"27 Nm @ 4,000 RPM", weight_kg:195 },
    { make:"Royal Enfield", model:"Meteor 350",  type:"Cruiser", displacement:"349", engine:"J-platform Single Cylinder", power:"20 HP @ 6,100 RPM", torque:"27 Nm @ 4,000 RPM", weight_kg:191 },
    { make:"Royal Enfield", model:"Interceptor 650",type:"Naked",displacement:"648",engine:"Parallel Twin SOHC", power:"47 HP @ 7,250 RPM", torque:"52 Nm @ 5,250 RPM", weight_kg:213 },
    { make:"Royal Enfield", model:"Continental GT 650",type:"Sport",displacement:"648",engine:"Parallel Twin SOHC", power:"47 HP @ 7,250 RPM", torque:"52 Nm @ 5,250 RPM", weight_kg:198 },
];

function searchMotoData(make, model) {
    if (!make) return null;
    const ml = make.toLowerCase().trim();
    const mo = (model || "").toLowerCase().trim();

    // 1. Exact make + exact model
    let m = motoData.find(b => b.make.toLowerCase() === ml && b.model.toLowerCase() === mo);
    if (m) return m;

    // 2. Exact make + model includes search term
    m = motoData.find(b => b.make.toLowerCase() === ml && b.model.toLowerCase().includes(mo));
    if (m) return m;

    // 3. Make includes search + model includes search
    m = motoData.find(b => b.make.toLowerCase().includes(ml) && b.model.toLowerCase().includes(mo));
    if (m) return m;

    // 4. Reverse: any entry whose model first word appears in the search model
    m = motoData.find(b => {
        const bMakeL  = b.make.toLowerCase();
        const bModelL = b.model.toLowerCase();
        return ml.includes(bMakeL) && mo.includes(bModelL.split(" ")[0]);
    });
    if (m) return m;

    // 5. Match on make only, return first entry for that maker
    m = motoData.find(b => b.make.toLowerCase() === ml || b.make.toLowerCase().includes(ml));
    return m || null;
}

// ─── Local car specs for brands with poor API coverage ────────────
// Used as fallback when API Ninjas returns no data
const localCarSpecs = [
    // ── Mercedes-Benz ──
    { make:"Mercedes-Benz", model:"C-Class", years:[2019,2020,2021,2022], class:"compact executive car", cylinders:4, displacement:2.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:255, torque:"295 lb-ft" },
    { make:"Mercedes-Benz", model:"E-Class", years:[2019,2020,2021,2022], class:"executive car", cylinders:6, displacement:3.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:362, torque:"369 lb-ft" },
    { make:"Mercedes-Benz", model:"S-Class", years:[2019,2020,2021,2022], class:"full-size luxury car", cylinders:6, displacement:3.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:429, torque:"384 lb-ft" },
    { make:"Mercedes-Benz", model:"A-Class", years:[2019,2020,2021,2022], class:"subcompact car", cylinders:4, displacement:2.0, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:188, torque:"221 lb-ft" },
    { make:"Mercedes-Benz", model:"GLC", years:[2019,2020,2021,2022], class:"compact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:255, torque:"273 lb-ft" },
    { make:"Mercedes-Benz", model:"GLE", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:362, torque:"369 lb-ft" },
    { make:"Mercedes-Benz", model:"GLA", years:[2019,2020,2021,2022], class:"subcompact suv", cylinders:4, displacement:2.0, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:221, torque:"258 lb-ft" },
    { make:"Mercedes-Benz", model:"CLA", years:[2019,2020,2021,2022], class:"compact car", cylinders:4, displacement:2.0, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:221, torque:"258 lb-ft" },
    { make:"Mercedes-Benz", model:"AMG GT", years:[2019,2020,2021,2022], class:"sports car", cylinders:8, displacement:4.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:469, torque:"465 lb-ft" },

    // ── BMW ──
    { make:"BMW", model:"3 Series", years:[2019,2020,2021,2022], class:"compact executive car", cylinders:4, displacement:2.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:255, torque:"295 lb-ft" },
    { make:"BMW", model:"5 Series", years:[2019,2020,2021,2022], class:"executive car", cylinders:4, displacement:2.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:248, torque:"258 lb-ft" },
    { make:"BMW", model:"7 Series", years:[2019,2020,2021,2022], class:"full-size luxury car", cylinders:6, displacement:3.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:335, torque:"330 lb-ft" },
    { make:"BMW", model:"X3", years:[2019,2020,2021,2022], class:"compact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:248, torque:"258 lb-ft" },
    { make:"BMW", model:"X5", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:335, torque:"330 lb-ft" },
    { make:"BMW", model:"X1", years:[2019,2020,2021,2022], class:"subcompact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:228, torque:"258 lb-ft" },
    { make:"BMW", model:"M3", years:[2019,2020,2021,2022], class:"compact car", cylinders:6, displacement:3.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:473, torque:"406 lb-ft" },
    { make:"BMW", model:"M5", years:[2019,2020,2021,2022], class:"executive car", cylinders:8, displacement:4.4, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:600, torque:"553 lb-ft" },
    { make:"BMW", model:"4 Series", years:[2019,2020,2021,2022], class:"compact car", cylinders:4, displacement:2.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:255, torque:"295 lb-ft" },
    { make:"BMW", model:"2 Series", years:[2019,2020,2021,2022], class:"subcompact car", cylinders:4, displacement:2.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:228, torque:"258 lb-ft" },

    // ── Audi ──
    { make:"Audi", model:"A4", years:[2019,2020,2021,2022], class:"compact executive car", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:201, torque:"236 lb-ft" },
    { make:"Audi", model:"A6", years:[2019,2020,2021,2022], class:"executive car", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:335, torque:"369 lb-ft" },
    { make:"Audi", model:"A3", years:[2019,2020,2021,2022], class:"subcompact car", cylinders:4, displacement:2.0, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:184, torque:"221 lb-ft" },
    { make:"Audi", model:"A8", years:[2019,2020,2021,2022], class:"full-size luxury car", cylinders:8, displacement:4.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:453, torque:"487 lb-ft" },
    { make:"Audi", model:"Q5", years:[2019,2020,2021,2022], class:"compact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:261, torque:"273 lb-ft" },
    { make:"Audi", model:"Q7", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:335, torque:"369 lb-ft" },
    { make:"Audi", model:"Q3", years:[2019,2020,2021,2022], class:"subcompact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:228, torque:"258 lb-ft" },
    { make:"Audi", model:"TT", years:[2019,2020,2021,2022], class:"sports car", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:228, torque:"258 lb-ft" },
    { make:"Audi", model:"R8", years:[2019,2020,2021,2022], class:"sports car", cylinders:10, displacement:5.2, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:562, torque:"406 lb-ft" },
    { make:"Audi", model:"RS6", years:[2019,2020,2021,2022], class:"executive car", cylinders:8, displacement:4.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:591, torque:"590 lb-ft" },

    // ── Volkswagen ──
    { make:"Volkswagen", model:"Golf", years:[2019,2020,2021,2022], class:"compact car", cylinders:4, displacement:2.0, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:228, torque:"258 lb-ft" },
    { make:"Volkswagen", model:"Passat", years:[2019,2020,2021,2022], class:"midsize car", cylinders:4, displacement:2.0, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:174, torque:"184 lb-ft" },
    { make:"Volkswagen", model:"Tiguan", years:[2019,2020,2021,2022], class:"compact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:184, torque:"221 lb-ft" },
    { make:"Volkswagen", model:"Atlas", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.6, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:276, torque:"266 lb-ft" },
    { make:"Volkswagen", model:"GTI", years:[2019,2020,2021,2022], class:"compact car", cylinders:4, displacement:2.0, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:228, torque:"258 lb-ft" },
    { make:"Volkswagen", model:"Jetta", years:[2019,2020,2021,2022], class:"compact car", cylinders:4, displacement:1.4, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:147, torque:"184 lb-ft" },

    // ── Porsche ──
    { make:"Porsche", model:"911", years:[2019,2020,2021,2022], class:"sports car", cylinders:6, displacement:3.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:379, torque:"331 lb-ft" },
    { make:"Porsche", model:"Cayenne", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:335, torque:"332 lb-ft" },
    { make:"Porsche", model:"Macan", years:[2019,2020,2021,2022], class:"compact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:248, torque:"273 lb-ft" },
    { make:"Porsche", model:"Panamera", years:[2019,2020,2021,2022], class:"executive car", cylinders:6, displacement:2.9, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:330, torque:"332 lb-ft" },
    { make:"Porsche", model:"Taycan", years:[2020,2021,2022], class:"executive car", cylinders:0, displacement:0, drive:"4wd", fuel_type:"electric", transmission:"a", horsepower:522, torque:"479 lb-ft" },

    // ── Volvo ──
    { make:"Volvo", model:"XC90", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:316, torque:"295 lb-ft" },
    { make:"Volvo", model:"XC60", years:[2019,2020,2021,2022], class:"compact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:250, torque:"258 lb-ft" },
    { make:"Volvo", model:"S60", years:[2019,2020,2021,2022], class:"compact car", cylinders:4, displacement:2.0, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:250, torque:"258 lb-ft" },
    { make:"Volvo", model:"S90", years:[2019,2020,2021,2022], class:"executive car", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:316, torque:"295 lb-ft" },

    // ── Land Rover ──
    { make:"Land Rover", model:"Range Rover", years:[2019,2020,2021,2022], class:"full-size suv", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:395, torque:"406 lb-ft" },
    { make:"Land Rover", model:"Discovery", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:355, torque:"369 lb-ft" },
    { make:"Land Rover", model:"Defender", years:[2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:395, torque:"406 lb-ft" },
    { make:"Land Rover", model:"Range Rover Sport", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:395, torque:"406 lb-ft" },

    // ── Jaguar ──
    { make:"Jaguar", model:"F-Type", years:[2019,2020,2021,2022], class:"sports car", cylinders:8, displacement:5.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:575, torque:"516 lb-ft" },
    { make:"Jaguar", model:"XE", years:[2019,2020,2021,2022], class:"compact car", cylinders:4, displacement:2.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:247, torque:"269 lb-ft" },
    { make:"Jaguar", model:"F-Pace", years:[2019,2020,2021,2022], class:"compact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:247, torque:"269 lb-ft" },

    // ── Lexus ──
    { make:"Lexus", model:"IS", years:[2019,2020,2021,2022], class:"compact car", cylinders:6, displacement:3.5, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:311, torque:"280 lb-ft" },
    { make:"Lexus", model:"ES", years:[2019,2020,2021,2022], class:"midsize car", cylinders:6, displacement:3.5, drive:"fwd", fuel_type:"gas", transmission:"a", horsepower:302, torque:"267 lb-ft" },
    { make:"Lexus", model:"RX", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:6, displacement:3.5, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:295, torque:"267 lb-ft" },
    { make:"Lexus", model:"NX", years:[2019,2020,2021,2022], class:"compact suv", cylinders:4, displacement:2.0, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:235, torque:"258 lb-ft" },
    { make:"Lexus", model:"LC", years:[2019,2020,2021,2022], class:"sports car", cylinders:10, displacement:5.0, drive:"rwd", fuel_type:"gas", transmission:"a", horsepower:471, torque:"398 lb-ft" },
    { make:"Lexus", model:"GX", years:[2019,2020,2021,2022], class:"midsize suv", cylinders:8, displacement:4.6, drive:"4wd", fuel_type:"gas", transmission:"a", horsepower:301, torque:"329 lb-ft" },
];

// Search local car specs — used as fallback when API returns nothing
function searchLocalCarSpecs(make, model, year) {
    const ml = make.toLowerCase().trim();
    const mo = model.toLowerCase().replace(/-/g, " ").trim();
    const yr = parseInt(year) || 0;

    let match = localCarSpecs.find(c => {
        const sameMake  = c.make.toLowerCase() === ml ||
                          c.make.toLowerCase().replace(/-/g, " ") === ml.replace(/-/g, " ");
        const sameModel = c.model.toLowerCase() === mo ||
                          c.model.toLowerCase().replace(/-/g, " ") === mo ||
                          mo.includes(c.model.toLowerCase().split(" ")[0]);
        const yearOk    = !yr || c.years.includes(yr) ||
                          (yr >= c.years[0] && yr <= c.years[c.years.length - 1]);
        return sameMake && sameModel && yearOk;
    });

    if (!match) {
        // Fuzzy: make starts-with + model first word matches
        match = localCarSpecs.find(c => {
            const makeOk  = ml.includes(c.make.toLowerCase().split(" ")[0]) ||
                            c.make.toLowerCase().includes(ml.split(" ")[0]);
            const modelOk = mo.includes(c.model.toLowerCase().split(" ")[0]) ||
                            c.model.toLowerCase().split(" ")[0].includes(mo.split(" ")[0]);
            return makeOk && modelOk;
        });
    }

    if (!match) return null;

    return {
        make:        match.make,
        model:       match.model,
        year:        yr || match.years[match.years.length - 1],
        class:       match.class,
        cylinders:   match.cylinders,
        displacement: match.displacement,
        drive:       match.drive,
        fuel_type:   match.fuel_type,
        transmission: match.transmission,
        horsepower:  match.horsepower,
        torque:      match.torque,
        _local:      true
    };
}