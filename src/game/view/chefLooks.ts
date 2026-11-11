import type { ChefId } from '../../core/economy';
import type { PersonLook } from './Person';

// How each famous chef of the collection looks (always the same, unlike random staff).
export const CHEF_LOOKS: Record<ChefId, PersonLook> = {
  selim: { skin: 0xf3c29b, hair: 0x262626, hairStyle: 'short', female: false, scarf: 0xd8452b },
  giulia: { skin: 0xffdcbf, hair: 0x3a2a1e, hairStyle: 'ponytail', female: true, scarf: 0x3a9a4a },
  amelie: { skin: 0xffdcbf, hair: 0xe8b84a, hairStyle: 'bob', female: true, scarf: 0x2f5fb0 },
  karim: { skin: 0xb07a52, hair: 0x262626, hairStyle: 'short', female: false, scarf: 0xe0a020 },
  priya: { skin: 0xd9a27a, hair: 0x262626, hairStyle: 'long', female: true, scarf: 0xd0408a },
  malee: { skin: 0xf3c29b, hair: 0x262626, hairStyle: 'bun', female: true, scarf: 0x8a4fc0 },
  kenji: { skin: 0xffdcbf, hair: 0x262626, hairStyle: 'short', female: false, scarf: 0x24346a },
  lucas: { skin: 0xd9a27a, hair: 0x6b4630, hairStyle: 'short', female: false, scarf: 0x2fa04a },
  sofia: { skin: 0xd9a27a, hair: 0x3a2a1e, hairStyle: 'long', female: true, scarf: 0xe0503f },
  jordan: { skin: 0x82573a, hair: 0x3a2a1e, hairStyle: 'short', female: false, scarf: 0x3d86d8 },
};
