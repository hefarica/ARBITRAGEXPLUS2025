/**
 * ============================================================================
 * ARCHIVO: ./services/engine-rust/benches/benchmark.rs
 * MÓDULO: Rust Engine
 * ============================================================================
 * 
 * 📥 ENTRADA:
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: benchmark_pathfinding
 * 
 * 📤 SALIDA:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_pathfinding(c: &mut Criterion) {
    c.bench_function("pathfinding", |b| b.iter(|| {
        black_box(42)
    }));
}

criterion_group!(benches, benchmark_pathfinding);
criterion_main!(benches);
