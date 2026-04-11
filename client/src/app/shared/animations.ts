import {
  animate,
  keyframes,
  query,
  stagger,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';

// Timing constants
export const T = {
  fast: '150ms',
  normal: '250ms',
  slow: '400ms',
  slower: '600ms',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  def: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
};

export const fadeInUp = trigger('fadeInUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(20px)' }),
    animate(`350ms ${T.out}`, style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);

export const fadeIn = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate(`${T.normal} ${T.out}`, style({ opacity: 1 })),
  ]),
]);

export const scaleIn = trigger('scaleIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.9)' }),
    animate(`${T.slow} ${T.spring}`, style({ opacity: 1, transform: 'scale(1)' })),
  ]),
]);

export const slideInRight = trigger('slideInRight', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(20px)' }),
    animate(`${T.normal} ${T.out}`, style({ opacity: 1, transform: 'translateX(0)' })),
  ]),
]);

export const slideInLeft = trigger('slideInLeft', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-20px)' }),
    animate(`${T.normal} ${T.out}`, style({ opacity: 1, transform: 'translateX(0)' })),
  ]),
]);

export const staggerList = trigger('staggerList', [
  transition(':enter', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(12px)' }),
      stagger('60ms', [
        animate(`${T.normal} ${T.out}`, style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ], { optional: true }),
  ]),
]);

export const expandCollapse = trigger('expandCollapse', [
  state('open', style({ height: '*', opacity: 1, overflow: 'hidden' })),
  state('closed', style({ height: '0px', opacity: 0, overflow: 'hidden' })),
  transition('open <=> closed', animate(`${T.normal} ${T.out}`)),
]);

export const pageTransition = trigger('pageTransition', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(8px)' }),
    animate(`${T.slow} ${T.out}`, style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    style({ opacity: 1, transform: 'translateY(0)' }),
    animate(`${T.normal} ${T.out}`, style({ opacity: 0, transform: 'translateY(-8px)' })),
  ]),
]);

export const cardHover = trigger('cardHover', [
  state('default', style({ transform: 'translateY(0)', boxShadow: 'none' })),
  state('hovered', style({ transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(37,99,235,0.15)' })),
  transition('default <=> hovered', animate(`${T.fast} ${T.spring}`)),
]);

export const shake = trigger('shake', [
  state('idle', style({ transform: 'translateX(0)' })),
  state('shaking', style({ transform: 'translateX(0)' })),
  transition('idle => shaking', animate('300ms', keyframes([
    style({ transform: 'translateX(0)', offset: 0 }),
    style({ transform: 'translateX(-8px)', offset: 0.2 }),
    style({ transform: 'translateX(8px)', offset: 0.4 }),
    style({ transform: 'translateX(-5px)', offset: 0.6 }),
    style({ transform: 'translateX(5px)', offset: 0.8 }),
    style({ transform: 'translateX(0)', offset: 1 }),
  ]))),
  transition('shaking => idle', animate('0ms')),
]);

export const buttonPress = trigger('buttonPress', [
  state('idle', style({ transform: 'scale(1)' })),
  state('pressed', style({ transform: 'scale(0.96)' })),
  transition('* <=> *', animate(`100ms ${T.spring}`)),
]);

export const listItem = trigger('listItem', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-10px)' }),
    animate(`${T.normal} ${T.out}`, style({ opacity: 1, transform: 'translateX(0)' })),
  ]),
]);

export const messageIn = trigger('messageIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.92)' }),
    animate(`${T.normal} ${T.spring}`, style({ opacity: 1, transform: 'scale(1)' })),
  ]),
]);
