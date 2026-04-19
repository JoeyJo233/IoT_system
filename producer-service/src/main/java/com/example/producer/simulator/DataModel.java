package com.example.producer.simulator;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Built-in data generation strategies. Each variant generates the next sensor
 * reading from the spec's [minValue, maxValue] range. Stateful models (e.g.
 * RANDOM_WALK, STEP) read and mutate the provided ModelState.
 */
public enum DataModel {

    /** Uniform random sample — baseline, independent readings. */
    RANDOM {
        @Override
        public double generate(SensorSpec spec, ModelState state) {
            return ThreadLocalRandom.current().nextDouble(spec.minValue(), spec.maxValue());
        }
    },

    /** Smooth sine oscillation. Period = 30 × intervalMs so the wave is always visible. */
    SINE {
        @Override
        public double generate(SensorSpec spec, ModelState state) {
            double periodMs = 30.0 * spec.intervalMs();
            double t = System.currentTimeMillis();
            double mid = (spec.minValue() + spec.maxValue()) / 2.0;
            double amp = (spec.maxValue() - spec.minValue()) / 2.0;
            return mid + amp * Math.sin(2.0 * Math.PI * t / periodMs);
        }
    },

    /** Brownian motion — each step is ±5 % of range, clamped to [min, max]. */
    RANDOM_WALK {
        @Override
        public double generate(SensorSpec spec, ModelState state) {
            double range = spec.maxValue() - spec.minValue();
            double current = (state.value != null) ? state.value : (spec.minValue() + spec.maxValue()) / 2.0;
            double step = range * 0.05;
            double next = current + ThreadLocalRandom.current().nextDouble(-step, step);
            next = Math.max(spec.minValue(), Math.min(spec.maxValue(), next));
            state.value = next;
            return next;
        }
    },

    /** Linear ramp from min to max over 20 intervals, then resets instantly. */
    SAWTOOTH {
        @Override
        public double generate(SensorSpec spec, ModelState state) {
            double periodMs = 20.0 * spec.intervalMs();
            double t = System.currentTimeMillis();
            double phase = (t % periodMs) / periodMs;
            return spec.minValue() + phase * (spec.maxValue() - spec.minValue());
        }
    },

    /** Holds a random value for ~8 ticks, then jumps to a new random value. */
    STEP {
        @Override
        public double generate(SensorSpec spec, ModelState state) {
            int tick = (state.tickCount != null) ? state.tickCount + 1 : 1;
            state.tickCount = tick;
            if (state.value == null || tick >= 8) {
                state.value = ThreadLocalRandom.current().nextDouble(spec.minValue(), spec.maxValue());
                state.tickCount = 0;
            }
            return state.value;
        }
    };

    public abstract double generate(SensorSpec spec, ModelState state);
}
