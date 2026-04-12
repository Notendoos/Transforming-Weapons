const dualFormWeapon = {
  id: "dual-form-weapon",
  label: "Dual-Form Weapon",
  defaultForm: "hammer",
  defaultState: "active",
  forms: {
    hammer: {
      label: "Hammer Form",
      attackBonus: 0,
      damageFormula: "1d8 + @mod",
      damageType: "bludgeoning",
      range: {
        mode: "melee",
        reach: 5,
        units: "ft"
      },
      weaponType: "simpleM"
    },
    cannon: {
      label: "Cannon Form",
      attackBonus: 1,
      damageFormula: "1d6 + @mod",
      damageType: "force",
      range: {
        mode: "ranged",
        value: 60,
        long: 240,
        units: "ft"
      },
      weaponType: "simpleR"
    }
  },
  states: {
    active: {
      label: "Active"
    }
  },
  restrictions: {
    switchCost: {
      label: "Switching forms costs a bonus action.",
      when: {
        forms: ["hammer", "cannon"]
      },
      effect: {
        type: "actionCost",
        cost: "bonusAction"
      }
    }
  },
  actions: {
    switchToHammer: {
      label: "Switch to Hammer",
      availableWhen: {
        form: "cannon",
        state: "active"
      },
      effects: [
        {
          type: "transitionForm",
          to: "hammer"
        }
      ]
    },
    switchToCannon: {
      label: "Switch to Cannon",
      availableWhen: {
        form: "hammer",
        state: "active"
      },
      effects: [
        {
          type: "transitionForm",
          to: "cannon"
        }
      ]
    }
  },
  ui: {
    summary: "Switch between a melee hammer and ranged cannon profile."
  }
};

export default dualFormWeapon;
