// @ts-check
import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Narrativ',
  tagline: 'AI-powered social media story creator',
  favicon: 'img/favicon.ico',

  url: 'https://narrativ.chaiovercode.com',
  baseUrl: '/',

  organizationName: 'chaiovercode',
  projectName: 'narrativ',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/chaiovercode/narrativ/tree/main/apps/docs/',
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/chaiovercode/narrativ/tree/main/apps/docs/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/narrativ-social-card.png',
      navbar: {
        title: 'Narrativ',
        logo: {
          alt: 'Narrativ Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          { to: '/blog', label: 'Blog', position: 'left' },
          {
            href: 'https://github.com/chaiovercode/narrativ',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/getting-started/installation',
              },
              {
                label: 'User Guide',
                to: '/docs/user-guide/story-creation',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/chaiovercode/narrativ',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/chaiovercode',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} Narrativ. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['python', 'rust', 'bash'],
      },
    }),
};

export default config;
