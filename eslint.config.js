import neostandard from 'neostandard';

export default [
  { ignores: ['dist/**'] },
  ...neostandard({ semi: true }),
  {
    languageOptions: {
      globals: {
        AFRAME: 'readonly',
        THREE: 'readonly',
        requestAnimationFrame: 'readonly'
      }
    }
  }
];
