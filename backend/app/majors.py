"""Daftar jurusan yang didukung pencari topik.

Bukan daftar tertutup: `resolve()` menerima nama bebas supaya mahasiswa dari
prodi yang belum terdaftar tetap bisa memakai aplikasi. Entri yang terdaftar
hanya memberi konteks tambahan (fakultas & tradisi metode) ke prompt agent.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Major:
    id: str
    name: str
    faculty: str
    traditions: str = ""


MAJORS: tuple[Major, ...] = (
    Major("si", "Sistem Informasi", "Ilmu Komputer", "eksperimen model, R&D sistem, survei kebergunaan"),
    Major("ti", "Teknik Informatika", "Ilmu Komputer", "eksperimen algoritma, R&D perangkat lunak"),
    Major("mnj", "Manajemen", "Ekonomi & Bisnis", "survei kuantitatif dengan uji regresi, studi kasus bisnis"),
    Major("akt", "Akuntansi", "Ekonomi & Bisnis", "analisis data sekunder laporan keuangan, studi kasus"),
    Major("psi", "Psikologi", "Psikologi", "korelasional dengan skala baku, fenomenologi"),
    Major("kep", "Keperawatan", "Ilmu Kesehatan", "korelasional, quasi-eksperimen (perlu izin etik)"),
    Major("pgsd", "PGSD / Pendidikan", "Keguruan & Ilmu Pendidikan", "penelitian tindakan kelas, R&D media ajar"),
    Major("hkm", "Ilmu Hukum", "Hukum", "yuridis normatif, yuridis empiris"),
    Major("kom", "Ilmu Komunikasi", "Ilmu Sosial & Politik", "analisis isi, studi resepsi, survei"),
    Major("sip", "Teknik Sipil", "Teknik", "eksperimen material, analisis struktur, studi lapangan"),
    Major("agri", "Agribisnis", "Pertanian", "analisis usaha tani, rantai pasok, survei petani"),
    Major("kesmas", "Kesehatan Masyarakat", "Ilmu Kesehatan", "cross-sectional, evaluasi program"),
    Major("far", "Farmasi", "Ilmu Kesehatan", "eksperimen laboratorium, studi penggunaan obat"),
    Major("sas", "Sastra Inggris", "Ilmu Budaya", "analisis wacana, kajian sastra, linguistik terapan"),
    Major("adm", "Administrasi Publik", "Ilmu Sosial & Politik", "evaluasi kebijakan, studi kasus pelayanan"),
    Major("esp", "Ekonomi Pembangunan", "Ekonomi & Bisnis", "analisis data sekunder, ekonometrika"),
)


def resolve(value: str) -> Major:
    """Terima id ('si'), nama ('Sistem Informasi'), atau nama bebas."""
    needle = value.strip().lower()
    for major in MAJORS:
        if needle in (major.id, major.name.lower()):
            return major
    for major in MAJORS:
        if needle and needle in major.name.lower():
            return major
    # Prodi di luar daftar tetap dilayani, hanya tanpa konteks tambahan.
    return Major(id="lain", name=value.strip() or "Umum", faculty="—", traditions="")


def as_dicts() -> list[dict]:
    return [
        {"id": m.id, "name": m.name, "faculty": m.faculty, "traditions": m.traditions}
        for m in MAJORS
    ]


def find(major_id: str) -> Optional[Major]:
    return next((m for m in MAJORS if m.id == major_id), None)
