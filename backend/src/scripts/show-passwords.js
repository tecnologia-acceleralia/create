#!/usr/bin/env node
import '../config/env.js';

// Contraseñas fijas definidas en los seeders
const FIXED_PASSWORDS = {
  'superadmin@create.dev': {
    password: '!CpUgGeV=50W',
    role: 'Super Admin'
  },
  'admin@demo.com': {
    password: 'k|Y]:Jl:k,9*',
    role: 'Admin Demo'
  },
  'captain@demo.com': {
    password: '0v3y!pFQZl.q',
    role: 'Capitan Demo'
  },
  'participant@demo.com': {
    password: '0v3y!pFQZl.q',
    role: 'Participante Demo'
  },
  'evaluator@demo.com': {
    password: '(u3I}ti1]V(r',
    role: 'Evaluador Demo'
  },
  // Usuarios de prueba demo
  'usuario1@demo.com': {
    password: 'dEm!pAsS1@demo',
    role: 'Capitan Demo (Proyecto 1)'
  },
  'usuario2@demo.com': {
    password: 'dEm!pAsS2@demo',
    role: 'Participante Demo (Proyecto 1)'
  },
  'usuario3@demo.com': {
    password: 'dEm!pAsS3@demo',
    role: 'Capitan Demo (Proyecto 2)'
  },
  'usuario4@demo.com': {
    password: 'dEm!pAsS4@demo',
    role: 'Participante Demo (Proyecto 2)'
  },
  'usuario5@demo.com': {
    password: 'dEm!pAsS5@demo',
    role: 'Capitan Demo (Proyecto 3)'
  },
  'usuario6@demo.com': {
    password: 'dEm!pAsS6@demo',
    role: 'Participante Demo (Proyecto 3)'
  },
  'usuario7@demo.com': {
    password: 'dEm!pAsS7@demo',
    role: 'Capitan Demo (Proyecto 4)'
  },
  'usuario8@demo.com': {
    password: 'dEm!pAsS8@demo',
    role: 'Participante Demo (Proyecto 4)'
  },
  'usuario9@demo.com': {
    password: 'dEm!pAsS9@demo',
    role: 'Capitan Demo (Proyecto 5)'
  },
  'usuario10@demo.com': {
    password: 'dEm!pAsS10@demo',
    role: 'Participante Demo (Proyecto 5)'
  },
  'admin@uic.es': {
    password: 'UdS*r2ZD5?;O',
    role: 'Admin UIC'
  },
  'mgraells@uic.es': {
    password: 'Ll4=u2D$S0>s',
    role: 'Admin Evaluador UIC'
  },
  'agironza@uic.es': {
    password: 'fJ(wvc7OrMOw99',
    role: 'Evaluador UIC'
  },
  'marisam@uic.es': {
    password: 'fJ(wvc7OrMOw5a',
    role: 'Evaluador UIC'
  },
  'margemi@uic.es': {
    password: 'fJ(wvc7OrMOw9r',
    role: 'Evaluador UIC'
  },
  'fdyck@uic.es': {
    password: 'fJ(wvc7OrMOw8f',
    role: 'Evaluador UIC'
  },
  'nnogales@uic.es': {
    password: 'fJ(wvc7OrMOw7o',
    role: 'Evaluador UIC'
  },
  // Usuarios de prueba UIC
  'usuario1@uic.es': {
    password: 'uIc!pAsS1@uic',
    role: 'Capitan UIC (Proyecto 1)'
  },
  'usuario2@uic.es': {
    password: 'uIc!pAsS2@uic',
    role: 'Participante UIC (Proyecto 1)'
  },
  'usuario3@uic.es': {
    password: 'uIc!pAsS3@uic',
    role: 'Capitan UIC (Proyecto 2)'
  },
  'usuario4@uic.es': {
    password: 'uIc!pAsS4@uic',
    role: 'Participante UIC (Proyecto 2)'
  },
  'usuario5@uic.es': {
    password: 'uIc!pAsS5@uic',
    role: 'Capitan UIC (Proyecto 3)'
  },
  'usuario6@uic.es': {
    password: 'uIc!pAsS6@uic',
    role: 'Participante UIC (Proyecto 3)'
  },
  'usuario7@uic.es': {
    password: 'uIc!pAsS7@uic',
    role: 'Capitan UIC (Proyecto 4)'
  },
  'usuario8@uic.es': {
    password: 'uIc!pAsS8@uic',
    role: 'Participante UIC (Proyecto 4)'
  },
  'usuario9@uic.es': {
    password: 'uIc!pAsS9@uic',
    role: 'Capitan UIC (Proyecto 5)'
  },
  'usuario10@uic.es': {
    password: 'uIc!pAsS10@uic',
    role: 'Participante UIC (Proyecto 5)'
  },
  'usuario11@uic.es': {
    password: 'uIc!pAsS11@uic',
    role: 'Usuario UIC (Sin equipo)'
  },
  'usuario12@uic.es': {
    password: 'uIc!pAsS12@uic',
    role: 'Usuario UIC (Sin equipo)'
  }
};

console.log(JSON.stringify(FIXED_PASSWORDS, null, 2));
