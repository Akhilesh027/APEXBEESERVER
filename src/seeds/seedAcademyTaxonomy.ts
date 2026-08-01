import Category from '../models/Category';
import CategoryExperienceConfig from '../models/CategoryExperienceConfig';

export const seedAcademyTaxonomy = async () => {
  console.log('[Academy Seeder] Seeding Academy parent category and subcategories...');

  // 1. Parent category: "ApexBee Academy"
  let parent = await Category.findOne({ slug: 'apexbee-academy', level: 1 });
  if (!parent) {
    parent = new Category({
      name: 'ApexBee Academy',
      slug: 'apexbee-academy',
      level: 1,
      isActive: true,
      image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=300&auto=format&fit=crop&q=60',
      description: 'Acquire new skills and build entrepreneurship capability with ApexBee Academy.',
      sortOrder: 6,
    });
    await parent.save();
    console.log('[Academy Seeder] Created parent category: ApexBee Academy');
  } else {
    // Keep it idempotent but ensure clean properties
    parent.name = 'ApexBee Academy';
    parent.isActive = true;
    await parent.save();
    console.log('[Academy Seeder] Parent category exists: ApexBee Academy');
  }

  // 2. Subcategories: "Become an Entrepreneur", "Skill Development"
  const subcategoriesDef = [
    {
      name: 'Become an Entrepreneur',
      slug: 'become-an-entrepreneur',
      description: 'Training and mentoring programs to start and scale local franchise businesses.',
      sortOrder: 1,
      experienceRoute: '/academy/become-an-entrepreneur',
    },
    {
      name: 'Skill Development',
      slug: 'skill-development',
      description: 'Vocational courses to enhance technical and management capabilities.',
      sortOrder: 2,
      experienceRoute: '/academy/skill-development',
    },
  ];

  const subDocs = [];
  for (const sub of subcategoriesDef) {
    let subDoc = await Category.findOne({ slug: sub.slug, level: 2, parentId: parent._id });
    if (!subDoc) {
      subDoc = new Category({
        name: sub.name,
        slug: sub.slug,
        level: 2,
        parentId: parent._id,
        isActive: true,
        image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=300&auto=format&fit=crop&q=60',
        description: sub.description,
        sortOrder: sub.sortOrder,
      });
      await subDoc.save();
      console.log(`[Academy Seeder] Created subcategory: ${sub.name}`);
    } else {
      subDoc.name = sub.name;
      subDoc.isActive = true;
      await subDoc.save();
      console.log(`[Academy Seeder] Subcategory exists: ${sub.name}`);
    }
    subDocs.push(subDoc);
  }

  // 3. Seed experience configurations
  const configsDef = [
    {
      categoryId: parent._id,
      experienceType: 'coming_soon_lead_capture',
      experienceRoute: '/academy',
      landingPageTitle: 'ApexBee Academy — Launching Soon',
      landingPageDescription: 'Empowering local communities with entrepreneurship and vocational skill development programs. Register your interest to get early access.',
      ctaLabel: 'Register Interest Now',
    },
    {
      categoryId: subDocs[0]._id,
      experienceType: 'coming_soon_lead_capture',
      experienceRoute: '/academy/become-an-entrepreneur',
      landingPageTitle: 'Become an Entrepreneur Program',
      landingPageDescription: 'Get certified, learn franchise management, and access seed funding opportunities. Register your interest today.',
      ctaLabel: 'Apply for Program',
    },
    {
      categoryId: subDocs[1]._id,
      experienceType: 'coming_soon_lead_capture',
      experienceRoute: '/academy/skill-development',
      landingPageTitle: 'Skill Development Courses',
      landingPageDescription: 'Acquire practical vocational skills in tech, retail, tailoring, beauty, and local services. Register your interest for course updates.',
      ctaLabel: 'Select Course & Register',
    },
  ];

  for (const config of configsDef) {
    await CategoryExperienceConfig.findOneAndUpdate(
      { categoryId: config.categoryId },
      {
        experienceType: config.experienceType,
        experienceRoute: config.experienceRoute,
        isVisible: true,
        comingSoon: true,
        leadCaptureEnabled: true,
        productCreationEnabled: false, // strictly blocked!
        purchaseEnabled: false, // strictly blocked!
        loginRequired: false,
        landingPageTitle: config.landingPageTitle,
        landingPageDescription: config.landingPageDescription,
        ctaLabel: config.ctaLabel,
      },
      { upsert: true, new: true }
    );
  }

  console.log('[Academy Seeder] Seeding CategoryExperienceConfig completed.');
};
export default seedAcademyTaxonomy;
