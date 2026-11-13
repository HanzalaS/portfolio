// Facts used across the site. One place to change them.
/** The site's base path ('/portfolio/'), always with a trailing slash. */
export const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export const site = {
  name: 'Hanzala Saeed',
  role: 'Full Stack AI Engineer',
  place: 'Nuremberg',
  description:
    'Hanzala Saeed is a full-stack AI engineer in Nuremberg and the founding engineer at DeepMask, building sovereign AI for Europe. 10+ apps shipped.',
  email: 'hanzalasaeed47@gmail.com',
  links: {
    linkedin: 'https://www.linkedin.com/in/hanzala-saeed/',
    github: 'https://github.com/HanzalaS',
    medium: 'https://medium.com/@hanzalasaeed47',
  },
} as const;
