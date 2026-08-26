/* ===========================================================================
   rockphysics.js — minimal rock-physics core for the AVO / fluid-effects site
   Vanilla JS, no dependencies. Sits next to seismic.js and leans on it for
   plotting; this file only knows about rocks and fluids, not pixels.

   Everything here is deliberately the SIMPLEST model that still behaves
   physically, because the point of Module 1 is the shape of the cause-and-
   effect chain, not geophysical precision:

     lithology + porosity  -->  dry-rock frame (K_dry, G_dry)
     fluid + saturation     -->  fluid modulus + fluid density
     Gassmann               -->  saturated rock (K_sat, G_sat, rho)
                             -->  Vp, Vs, impedance

   Units: moduli in GPa, density in g/cc, velocity in km/s (so K/rho gives
   km/s directly with no unit juggling), porosity as a fraction 0-1.
   =========================================================================== */

const ROCK = (function () {
  'use strict';

  /* ---------------------------------------------------------------------
     MINERALS (the solid grains) and DRY-FRAME MODEL

     K, G: the mineral's own bulk/shear modulus, GPa — quartz for
     sandstone, an average clay mineral for shale.
     rho: grain density, g/cc.
     phiC: "critical porosity" — the porosity at which the grain framework
     falls apart and stiffness goes to zero (loose sand at the seafloor,
     roughly). Modeling the dry frame as stiffness falling off linearly
     from the mineral value at phi=0 to zero at phi=phiC (Nur's critical-
     porosity idea, simplified to a straight line) is the standard first
     teaching model for "porosity weakens the rock" — it is not a precise
     lab model, but it is honest about the physics: more pore space, less
     grain-to-grain contact, a softer frame.
     --------------------------------------------------------------------- */
  const MINERALS = {
    sandstone: { label: 'Sandstone (quartz)', K: 37, G: 44, rho: 2.65, phiC: 0.40 },
    shale:     { label: 'Shale (clay)',        K: 21, G: 9,  rho: 2.70, phiC: 0.55 },
  };

  // Dry-frame moduli at a given porosity. Softens linearly to ~0 at phiC.
  function dryFrame(mineral, phi) {
    const p = Math.max(0, Math.min(phi, mineral.phiC * 0.985));
    const frac = Math.max(0.015, 1 - p / mineral.phiC);
    return { Kdry: mineral.K * frac, Gdry: mineral.G * frac };
  }

  /* ---------------------------------------------------------------------
     FLUIDS

     Brine and gas are held at simple representative reservoir-condition
     values. Oil's properties are let vary with API gravity, because that
     is the one fluid property students are used to seeing quoted, and it
     is a nice single dial: heavy oil behaves almost like brine, light oil
     behaves almost like gas.
     --------------------------------------------------------------------- */
  const BRINE = { K: 2.8, rho: 1.03 };
  const GAS   = { K: 0.025, rho: 0.15 };

  // API gravity -> stock-tank oil density (the standard API formula),
  // then a simple monotonic API -> velocity trend so that K = rho*Vp^2
  // comes out heavier/slower for heavy (low-API) oil and lighter/faster
  // for light (high-API) oil, bracketed between brine and gas.
  function oilProps(api) {
    const A = Math.max(10, Math.min(45, api));
    const rho = 141.5 / (131.5 + A);                 // g/cc
    const vp = 1.55 - 0.013 * (A - 10);               // km/s, heavier oil is slower
    const K = rho * vp * vp;                          // GPa
    return { K, rho, vp };
  }

  // Reuss (uniform-mixing) average for the pore fluid, the standard
  // assumption for a well-mixed brine/hydrocarbon pore fill.
  function mixFluid(sw, brine, hc) {
    const sh = 1 - sw;
    const Kfl = 1 / (sw / brine.K + sh / hc.K);
    const rhofl = sw * brine.rho + sh * hc.rho;
    return { K: Kfl, rho: rhofl };
  }

  /* ---------------------------------------------------------------------
     GASSMANN FLUID SUBSTITUTION

     Ksat = Kdry + (1 - Kdry/Kmin)^2 / ( phi/Kfl + (1-phi)/Kmin - Kdry/Kmin^2 )
     Gsat = Gdry   (shear modulus does not see the pore fluid at all —
                     this is the fact that makes Vs/density such a useful
                     lithology indicator, independent of what's in the pores)
     --------------------------------------------------------------------- */
  function gassmann(Kdry, Kmin, phi, Kfl) {
    const num = Math.pow(1 - Kdry / Kmin, 2);
    const den = phi / Kfl + (1 - phi) / Kmin - Kdry / (Kmin * Kmin);
    return Kdry + num / Math.max(den, 1e-6);
  }

  /* ---------------------------------------------------------------------
     PUBLIC: build a full elastic description of one rock.

     cfg = { lithology: 'sandstone'|'shale', phi: 0..~0.38 (fraction),
             fluid: 'brine'|'oil'|'gas', sat: 0..1 (hydrocarbon saturation,
             ignored for brine), api: 10..45 (oil only) }
     --------------------------------------------------------------------- */
  function computeRock(cfg) {
    const mineral = MINERALS[cfg.lithology] || MINERALS.sandstone;
    const phi = Math.max(0.001, Math.min(cfg.phi, mineral.phiC * 0.98));
    const { Kdry, Gdry } = dryFrame(mineral, phi);

    const hc = cfg.fluid === 'gas' ? GAS
             : cfg.fluid === 'oil' ? oilProps(cfg.api || 30)
             : BRINE;
    const sw = cfg.fluid === 'brine' ? 1 : Math.max(0, Math.min(1, 1 - (cfg.sat || 0)));
    const fluid = mixFluid(sw, BRINE, hc);

    const Ksat = gassmann(Kdry, mineral.K, phi, fluid.K);
    const Gsat = Gdry;
    const rho = (1 - phi) * mineral.rho + phi * fluid.rho;

    const Vp = Math.sqrt(Math.max(Ksat + (4 / 3) * Gsat, 1e-6) / rho);   // km/s
    const Vs = Math.sqrt(Math.max(Gsat, 1e-6) / rho);                    // km/s
    const AI = Vp * rho;             // 10^3 * (m/s * g/cc) == the usual 10^6 kg m^-2 s^-1 units
    const SI = Vs * rho;

    return {
      lithology: cfg.lithology, phi, fluid: cfg.fluid, sat: sw < 1 ? 1 - sw : 0,
      api: cfg.api, mineral,
      Kdry, Gdry, Ksat, Gsat, Kfl: fluid.K, rhoFl: fluid.rho,
      Vp, Vs, rho, AI, SI, VpVs: Vp / Vs,
    };
  }

  // A fixed shale used for the encasing layers above/below the reservoir —
  // deliberately the same numbers as the "sand encased in shale" preset in
  // Module 01 of the seismic-fundamentals site, so a student who has used
  // both sites recognizes the background rock.
  const BACKGROUND_SHALE = { n: 'Shale', Vp: 2.45, Vs: 1.13, rho: 2.38 };
  // (Vs is not used by that sibling site; ~0.46*Vp is a typical shale Vp/Vs ~2.2)

  return {
    MINERALS, BRINE, GAS, oilProps, mixFluid, dryFrame, gassmann,
    computeRock, BACKGROUND_SHALE,
  };
})();
