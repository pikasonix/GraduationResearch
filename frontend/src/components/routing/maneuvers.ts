// Icon mapping for maneuvers (SVGs live in src/components/icon/map)
const ICONS: Record<string, string> = {
    'arrive': new URL('../icon/map/arrive.svg', import.meta.url).href,
    'arrive_left': new URL('../icon/map/arrive_left.svg', import.meta.url).href,
    'arrive_right': new URL('../icon/map/arrive_right.svg', import.meta.url).href,
    'arrive_straight': new URL('../icon/map/arrive_straight.svg', import.meta.url).href,
    'close': new URL('../icon/map/close.svg', import.meta.url).href,
    'continue': new URL('../icon/map/continue.svg', import.meta.url).href,
    'continue_left': new URL('../icon/map/continue_left.svg', import.meta.url).href,
    'continue_right': new URL('../icon/map/continue_right.svg', import.meta.url).href,
    'continue_slight_left': new URL('../icon/map/continue_slight_left.svg', import.meta.url).href,
    'continue_slight_right': new URL('../icon/map/continue_slight_right.svg', import.meta.url).href,
    'continue_straight': new URL('../icon/map/continue_straight.svg', import.meta.url).href,
    'continue_uturn': new URL('../icon/map/continue_uturn.svg', import.meta.url).href,
    'depart': new URL('../icon/map/depart.svg', import.meta.url).href,
    'depart_left': new URL('../icon/map/depart_left.svg', import.meta.url).href,
    'depart_right': new URL('../icon/map/depart_right.svg', import.meta.url).href,
    'depart_straight': new URL('../icon/map/depart_straight.svg', import.meta.url).href,
    'end_of_road_left': new URL('../icon/map/end_of_road_left.svg', import.meta.url).href,
    'end_of_road_right': new URL('../icon/map/end_of_road_right.svg', import.meta.url).href,
    'flag': new URL('../icon/map/flag.svg', import.meta.url).href,
    'fork': new URL('../icon/map/fork.svg', import.meta.url).href,
    'fork_left': new URL('../icon/map/fork_left.svg', import.meta.url).href,
    'fork_right': new URL('../icon/map/fork_right.svg', import.meta.url).href,
    'fork_slight_left': new URL('../icon/map/fork_slight_left.svg', import.meta.url).href,
    'fork_slight_right': new URL('../icon/map/fork_slight_right.svg', import.meta.url).href,
    'fork_straight': new URL('../icon/map/fork_straight.svg', import.meta.url).href,
    'invalid': new URL('../icon/map/invalid.svg', import.meta.url).href,
    'invalid_left': new URL('../icon/map/invalid_left.svg', import.meta.url).href,
    'invalid_right': new URL('../icon/map/invalid_right.svg', import.meta.url).href,
    'invalid_slight_left': new URL('../icon/map/invalid_slight_left.svg', import.meta.url).href,
    'invalid_slight_right': new URL('../icon/map/invalid_slight_right.svg', import.meta.url).href,
    'invalid_straight': new URL('../icon/map/invalid_straight.svg', import.meta.url).href,
    'invalid_uturn': new URL('../icon/map/invalid_uturn.svg', import.meta.url).href,
    'merge_left': new URL('../icon/map/merge_left.svg', import.meta.url).href,
    'merge_right': new URL('../icon/map/merge_right.svg', import.meta.url).href,
    'merge_slight_left': new URL('../icon/map/merge_slight_left.svg', import.meta.url).href,
    'merge_slight_right': new URL('../icon/map/merge_slight_right.svg', import.meta.url).href,
    'merge_straight': new URL('../icon/map/merge_straight.svg', import.meta.url).href,
    'new_name_left': new URL('../icon/map/new_name_left.svg', import.meta.url).href,
    'new_name_right': new URL('../icon/map/new_name_right.svg', import.meta.url).href,
    'new_name_sharp_left': new URL('../icon/map/new_name_sharp_left.svg', import.meta.url).href,
    'new_name_sharp_right': new URL('../icon/map/new_name_sharp_right.svg', import.meta.url).href,
    'new_name_slight_left': new URL('../icon/map/new_name_slight_left.svg', import.meta.url).href,
    'new_name_slight_right': new URL('../icon/map/new_name_slight_right.svg', import.meta.url).href,
    'new_name_straight': new URL('../icon/map/new_name_straight.svg', import.meta.url).href,
    'notificaiton_sharp_right': new URL('../icon/map/notificaiton_sharp_right.svg', import.meta.url).href,
    'notification_left': new URL('../icon/map/notification_left.svg', import.meta.url).href,
    'notification_right': new URL('../icon/map/notification_right.svg', import.meta.url).href,
    'notification_sharp_left': new URL('../icon/map/notification_sharp_left.svg', import.meta.url).href,
    'notification_sharp_right': new URL('../icon/map/notificaiton_sharp_right.svg', import.meta.url).href,
    'notification_slight_left': new URL('../icon/map/notification_slight_left.svg', import.meta.url).href,
    'notification_slight_right': new URL('../icon/map/notification_slight_right.svg', import.meta.url).href,
    'notification_straight': new URL('../icon/map/notification_straight.svg', import.meta.url).href,
    'off_ramp_left': new URL('../icon/map/off_ramp_left.svg', import.meta.url).href,
    'off_ramp_right': new URL('../icon/map/off_ramp_right.svg', import.meta.url).href,
    'off_ramp_slight_left': new URL('../icon/map/off_ramp_slight_left.svg', import.meta.url).href,
    'off_ramp_slight_right': new URL('../icon/map/off_ramp_slight_right.svg', import.meta.url).href,
    'on_ramp_left': new URL('../icon/map/on_ramp_left.svg', import.meta.url).href,
    'on_ramp_right': new URL('../icon/map/on_ramp_right.svg', import.meta.url).href,
    'on_ramp_sharp_left': new URL('../icon/map/on_ramp_sharp_left.svg', import.meta.url).href,
    'on_ramp_sharp_right': new URL('../icon/map/on_ramp_sharp_right.svg', import.meta.url).href,
    'on_ramp_slight_left': new URL('../icon/map/on_ramp_slight_left.svg', import.meta.url).href,
    'on_ramp_slight_right': new URL('../icon/map/on_ramp_slight_right.svg', import.meta.url).href,
    'on_ramp_straight': new URL('../icon/map/on_ramp_straight.svg', import.meta.url).href,
    'rotary': new URL('../icon/map/rotary.svg', import.meta.url).href,
    'rotary_left': new URL('../icon/map/rotary_left.svg', import.meta.url).href,
    'rotary_right': new URL('../icon/map/rotary_right.svg', import.meta.url).href,
    'rotary_sharp_left': new URL('../icon/map/rotary_sharp_left.svg', import.meta.url).href,
    'rotary_sharp_right': new URL('../icon/map/rotary_sharp_right.svg', import.meta.url).href,
    'rotary_slight_left': new URL('../icon/map/rotary_slight_left.svg', import.meta.url).href,
    'rotary_slight_right': new URL('../icon/map/rotary_slight_right.svg', import.meta.url).href,
    'rotary_straight': new URL('../icon/map/rotary_straight.svg', import.meta.url).href,
    'roundabout': new URL('../icon/map/roundabout.svg', import.meta.url).href,
    'roundabout_left': new URL('../icon/map/roundabout_left.svg', import.meta.url).href,
    'roundabout_right': new URL('../icon/map/roundabout_right.svg', import.meta.url).href,
    'roundabout_sharp_left': new URL('../icon/map/roundabout_sharp_left.svg', import.meta.url).href,
    'roundabout_sharp_right': new URL('../icon/map/roundabout_sharp_right.svg', import.meta.url).href,
    'roundabout_slight_left': new URL('../icon/map/roundabout_slight_left.svg', import.meta.url).href,
    'roundabout_slight_right': new URL('../icon/map/roundabout_slight_right.svg', import.meta.url).href,
    'roundabout_straight': new URL('../icon/map/roundabout_straight.svg', import.meta.url).href,
    'turn_left': new URL('../icon/map/turn_left.svg', import.meta.url).href,
    'turn_right': new URL('../icon/map/turn_right.svg', import.meta.url).href,
    'turn_sharp_left': new URL('../icon/map/turn_sharp_left.svg', import.meta.url).href,
    'turn_sharp_right': new URL('../icon/map/turn_sharp_right.svg', import.meta.url).href,
    'turn_slight_left': new URL('../icon/map/turn_slight_left.svg', import.meta.url).href,
    'turn_slight_right': new URL('../icon/map/turn_slight_right.svg', import.meta.url).href,
    'turn_straight': new URL('../icon/map/turn_straight.svg', import.meta.url).href,
    'updown': new URL('../icon/map/updown.svg', import.meta.url).href,
    'uturn': new URL('../icon/map/uturn.svg', import.meta.url).href,
};

const modifierToDeg = (modifier?: string): number => {
    const m = (modifier || '').toLowerCase();
    switch (m) {
        case 'slight right': return 45;
        case 'right': return 90;
        case 'sharp right': return 135;
        case 'uturn': return 180;
        case 'sharp left': return -135;
        case 'left': return -90;
        case 'slight left': return -45;
        case 'straight':
        default: return 0;
    }
};

const sanitize = (value?: string | null): string => (value || '').toLowerCase().trim();

const normalizeKey = (value: string): string => value.replace(/\s+/g, '_');

export const pickManeuverIcon = (step: any): { src?: string; rotate: number } => {
    const typeRaw = sanitize(step?.maneuver?.type);
    const modifierRaw = sanitize(step?.maneuver?.modifier);
    const typeKey = normalizeKey(typeRaw);
    const modifierKey = normalizeKey(modifierRaw);

    const addCandidate = (list: string[], value?: string) => {
        if (!value) return;
        if (!list.includes(value)) list.push(value);
    };

    const candidates: string[] = [];

    if (typeKey && modifierKey) addCandidate(candidates, `${typeKey}_${modifierKey}`);
    if (typeKey) addCandidate(candidates, typeKey);

    if (typeKey === 'turn') {
        if (modifierKey === 'uturn') {
            addCandidate(candidates, 'uturn');
        }
        if (!modifierKey) {
            addCandidate(candidates, 'turn_straight');
        }
    }

    if (typeKey === 'continue' && !modifierKey) addCandidate(candidates, 'continue_straight');
    if (typeKey === 'notification') {
        if (!modifierKey) addCandidate(candidates, 'notification_straight');
        if (modifierKey === 'sharp_right') addCandidate(candidates, 'notificaiton_sharp_right');
    }

    if (typeKey === 'use_lane') {
        if (modifierKey) addCandidate(candidates, `notification_${modifierKey}`);
        addCandidate(candidates, 'notification_straight');
    }

    if (typeKey === 'roundabout_turn') {
        if (modifierKey) addCandidate(candidates, `roundabout_${modifierKey}`);
        addCandidate(candidates, 'roundabout');
    }

    if (typeKey === 'exit_roundabout') {
        if (modifierKey) addCandidate(candidates, `roundabout_${modifierKey}`);
        addCandidate(candidates, 'roundabout');
    }

    if (typeKey === 'exit_rotary') {
        if (modifierKey) addCandidate(candidates, `rotary_${modifierKey}`);
        addCandidate(candidates, 'rotary');
    }

    if (!modifierKey) {
        switch (typeKey) {
            case 'merge': addCandidate(candidates, 'merge_straight'); break;
            case 'fork': addCandidate(candidates, 'fork'); break;
            case 'new_name': addCandidate(candidates, 'new_name_straight'); break;
            case 'on_ramp': addCandidate(candidates, 'on_ramp_straight'); break;
            case 'notification': addCandidate(candidates, 'notification_straight'); break;
            case 'arrive': addCandidate(candidates, 'arrive_straight'); break;
            case 'depart': addCandidate(candidates, 'depart_straight'); break;
        }
    }

    const rotate = modifierToDeg(modifierRaw);
    for (const key of candidates) {
        const src = ICONS[key];
        if (src) return { src, rotate };
    }

    return { src: undefined, rotate };
};
