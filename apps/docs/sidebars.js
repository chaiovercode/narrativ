/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/api-keys',
        'getting-started/first-story',
      ],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'user-guide/story-creation',
        'user-guide/styles',
        'user-guide/branding',
        'user-guide/gallery',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/endpoints',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      items: [
        'development/contributing',
      ],
    },
  ],
};

export default sidebars;
