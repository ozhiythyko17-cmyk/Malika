-- Pengaturan utama game "Summit Bareng JOTI 2026".
-- Ubah nilai di sini untuk menyesuaikan nama acara, tingkat kesulitan, dan warna.

local Config = {}

-- Identitas acara
Config.EVENT_NAME = "JOTI 2026"
Config.ORGANIZER = "Kwarcab Kota Tangerang"
Config.MOUNTAIN_NAME = "Gunung Tunas Kelapa"
Config.WELCOME_TEXT = "Salam Pramuka! Selamat datang di Summit Bareng JOTI 2026 - Kwarcab Kota Tangerang"

-- Bentuk gunung
-- Jumlah tahap pendakian. Pos 1 .. Pos (STAGES - 1), lalu tahap terakhir berakhir di Puncak.
Config.STAGES = 8
Config.STAGE_HEIGHT = 36 -- tinggi tiap tahap (stud)
Config.BASE_RADIUS = 150 -- jari-jari kaki gunung
Config.RADIUS_STEP = 16 -- lebar "teras" tempat Pos berada (selisih jari-jari antar tahap)

-- Tingkat kesulitan jalur (makin besar SPACING / makin kecil SIZE = makin sulit)
Config.PLATFORMS_PER_STAGE = 9
Config.PLATFORM_SIZE = 6 -- ukuran pijakan (stud)
Config.PLATFORM_SPACING = 10 -- jarak antar-pusat pijakan (stud)

-- Penyimpanan data (jumlah summit, pos terakhir, rekor waktu).
-- Aktifkan "Enable Studio Access to API Services" di Game Settings > Security agar jalan di Studio.
Config.USE_DATASTORE = true
Config.DATASTORE_NAME = "JOTI2026_SummitBareng_v1"

-- Jumlah nama terakhir yang ditampilkan di papan "Buku Puncak"
Config.SUMMIT_BOARD_SIZE = 10

Config.COLORS = {
	Grass = Color3.fromRGB(86, 140, 62),
	Rock = Color3.fromRGB(120, 105, 90),
	RockHigh = Color3.fromRGB(150, 140, 130),
	Platform = Color3.fromRGB(196, 154, 108),
	Checkpoint = Color3.fromRGB(255, 196, 0),
	Summit = Color3.fromRGB(255, 255, 255),
	ScoutBrown = Color3.fromRGB(110, 75, 40),
	Red = Color3.fromRGB(206, 17, 38),
	White = Color3.fromRGB(255, 255, 255),
}

-- Nama tiap checkpoint: 0 = Basecamp, STAGES = Puncak
function Config.checkpointName(index)
	if index <= 0 then
		return "Basecamp"
	elseif index >= Config.STAGES then
		return "Puncak"
	end
	return "Pos " .. index
end

function Config.formatTime(seconds)
	seconds = math.max(0, math.floor(seconds))
	local h = math.floor(seconds / 3600)
	local m = math.floor((seconds % 3600) / 60)
	local s = seconds % 60
	if h > 0 then
		return string.format("%d:%02d:%02d", h, m, s)
	end
	return string.format("%02d:%02d", m, s)
end

return Config
