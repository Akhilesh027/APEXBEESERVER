import { DevotionalProductSeed } from './devotionalProductTypes';

export const devotionalServicesProducts: DevotionalProductSeed[] = [
  {
    seedKey: 'devotional:temple-priest-devotional-services:priest-booking:qualified-vedic-pandit-priest-booking-service',
    name: 'Vedic Pandit / Priest Doorstep Booking Service',
    slug: 'qualified-vedic-pandit-priest-booking-service',
    subcategorySlug: 'temple-priest-devotional-services',
    childCategorySlug: 'priest-booking',
    itemType: 'service',
    productMode: 'service',
    shortDescription: 'Professional booking service for verified experienced Vedic priests to perform rituals at your home or office.',
    keywords: ['priest booking', 'pandit for pooja', 'purohit booking', 'vedic pandit', 'doorstep priest'],
    tags: ['service', 'priest', 'pandit'],
    supportedUnits: ['booking', 'service_slot'],
    deliveryRules: { homeDelivery: false, storePickup: false },
    serviceRules: {
      serviceLocation: 'Customer Doorstep / Venue',
      onlineOrOffline: 'Offline In-Person',
      priestLanguage: ['Telugu', 'Hindi', 'Tamil', 'Kannada', 'Sanskrit']
    },
    variantDefinitions: [
      { name: '1 Priest Service', skuSuffix: '1P', attributes: { numberOfPriests: 1 } },
      { name: '2 Priests Homam Team', skuSuffix: '2P', attributes: { numberOfPriests: 2 } }
    ]
  },
  {
    seedKey: 'devotional:temple-priest-devotional-services:satyanarayana-vratham-service:satyanarayana-vratham-priest-service',
    name: 'Satyanarayana Swamy Vratham Priest & Ritual Service',
    slug: 'satyanarayana-vratham-priest-service',
    subcategorySlug: 'temple-priest-devotional-services',
    childCategorySlug: 'satyanarayana-vratham-service',
    itemType: 'service',
    productMode: 'service',
    shortDescription: 'End-to-end Satyanarayana Vratham officiating service including story recitation, aarti, and blessing rituals.',
    keywords: ['satyanarayana vratham service', 'vratham pandit', 'satyanarayana pooja service'],
    tags: ['service', 'satyanarayana', 'vratham'],
    supportedUnits: ['booking'],
    serviceRules: { durationMinutes: 180, onlineOrOffline: 'Offline / Online Option' },
    variantDefinitions: [
      { name: 'In-Person Home Vratham', skuSuffix: 'HOME', attributes: { mode: 'In-Person Home' } },
      { name: 'E-Pooja Virtual Vratham', skuSuffix: 'ONLINE', attributes: { mode: 'Online Virtual' } }
    ]
  },
  {
    seedKey: 'devotional:temple-priest-devotional-services:astrology-consultation:vedic-astrology-horoscope-consultation',
    name: 'Personalised Vedic Astrology & Horoscope Consultation',
    slug: 'vedic-astrology-horoscope-consultation',
    subcategorySlug: 'temple-priest-devotional-services',
    childCategorySlug: 'astrology-consultation',
    itemType: 'service',
    productMode: 'service',
    shortDescription: 'Detailed one-on-one astrology consultation session covering janma kundali, career, health, and remedies.',
    keywords: ['astrology consultation', 'horoscope reading', 'jathakam', 'astrologer booking'],
    tags: ['service', 'astrology'],
    supportedUnits: ['session', 'consultation'],
    serviceRules: { durationMinutes: 45, onlineOrOffline: 'Online Video Call / Telephonic' },
    variantDefinitions: [
      { name: '30 Mins Consultation', skuSuffix: '30M', attributes: { durationMinutes: 30 } },
      { name: '60 Mins Comprehensive Session', skuSuffix: '60M', attributes: { durationMinutes: 60 } }
    ]
  }
];
