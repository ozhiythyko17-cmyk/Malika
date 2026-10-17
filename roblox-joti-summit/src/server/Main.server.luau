-- Server utama Summit Bareng JOTI 2026:
-- checkpoint (Pos), respawn di Pos terakhir, hitung summit, waktu pendakian,
-- papan "Buku Puncak", pengumuman, dan penyimpanan data.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")

local Config = require(ReplicatedStorage:WaitForChild("SummitShared"):WaitForChild("Config"))
local MapBuilder = require(script.Parent:WaitForChild("MapBuilder"))

local map = MapBuilder.getOrBuild()
local checkpointFolder = map:WaitForChild("Checkpoints")

-- Remote untuk komunikasi dengan client
local remotes = Instance.new("Folder")
remotes.Name = "SummitRemotes"
local announceEvent = Instance.new("RemoteEvent")
announceEvent.Name = "Announce"
announceEvent.Parent = remotes
local basecampEvent = Instance.new("RemoteEvent")
basecampEvent.Name = "ToBasecamp"
basecampEvent.Parent = remotes
remotes.Parent = ReplicatedStorage

-- Data store (opsional; aman bila tidak tersedia)
local store = nil
if Config.USE_DATASTORE then
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DATASTORE_NAME)
	end)
	if ok then
		store = result
	else
		warn("[Summit] DataStore tidak tersedia, data tidak disimpan: " .. tostring(result))
	end
end

local checkpointParts = {}
for _, part in ipairs(checkpointFolder:GetChildren()) do
	local index = part:GetAttribute("Index")
	if index then
		checkpointParts[index] = part
	end
end

local summitLog = {} -- { {name=..., time=...}, ... } terbaru di depan
local lastBasecampRequest = {}

local function now()
	return workspace:GetServerTimeNow()
end

local function updateBoard()
	local board = map:FindFirstChild("BukuPuncak")
	local gui = board and board:FindFirstChild("BoardGui")
	local list = gui and gui:FindFirstChild("List")
	if not list then
		return
	end
	if #summitLog == 0 then
		list.Text = "Belum ada yang sampai puncak.\nAyo jadi yang pertama!"
		return
	end
	local lines = {}
	for i, entry in ipairs(summitLog) do
		lines[i] = string.format("%d. %s  (%s)", i, entry.name, Config.formatTime(entry.time))
	end
	list.Text = table.concat(lines, "\n")
end

local function setCheckpoint(player, index)
	player:SetAttribute("Checkpoint", index)
	local leaderstats = player:FindFirstChild("leaderstats")
	local posValue = leaderstats and leaderstats:FindFirstChild("Posisi")
	if posValue then
		posValue.Value = Config.checkpointName(index)
	end
end

local function loadData(player)
	local data = nil
	if store then
		local ok, result = pcall(function()
			return store:GetAsync("u_" .. player.UserId)
		end)
		if ok then
			data = result
		else
			warn("[Summit] Gagal memuat data " .. player.Name .. ": " .. tostring(result))
		end
	end
	return data or {}
end

local function saveData(player)
	if not store or not player:GetAttribute("DataLoaded") then
		return
	end
	local data = {
		checkpoint = player:GetAttribute("Checkpoint") or 0,
		summits = player:GetAttribute("Summits") or 0,
		bestTime = player:GetAttribute("BestTime"),
	}
	local ok, err = pcall(function()
		store:SetAsync("u_" .. player.UserId, data)
	end)
	if not ok then
		warn("[Summit] Gagal menyimpan data " .. player.Name .. ": " .. tostring(err))
	end
end

local function reachSummit(player)
	local elapsed = now() - (player:GetAttribute("ClimbStart") or now())
	local summits = (player:GetAttribute("Summits") or 0) + 1
	player:SetAttribute("Summits", summits)

	local leaderstats = player:FindFirstChild("leaderstats")
	local summitValue = leaderstats and leaderstats:FindFirstChild("Summit")
	if summitValue then
		summitValue.Value = summits
	end

	player:SetAttribute("LastTime", elapsed)

	local best = player:GetAttribute("BestTime")
	local isRecord = best == nil or elapsed < best
	if isRecord then
		player:SetAttribute("BestTime", elapsed)
	end

	table.insert(summitLog, 1, { name = player.DisplayName, time = elapsed })
	while #summitLog > Config.SUMMIT_BOARD_SIZE do
		table.remove(summitLog)
	end
	updateBoard()

	local message = string.format(
		"%s sampai di PUNCAK %s dalam %s!",
		player.DisplayName,
		Config.MOUNTAIN_NAME,
		Config.formatTime(elapsed)
	)
	if isRecord and summits > 1 then
		message = message .. " (Rekor baru!)"
	end
	announceEvent:FireAllClients(message)
	task.spawn(saveData, player)
end

local function onCheckpointTouched(part, hit)
	local character = hit.Parent
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return
	end
	local player = Players:GetPlayerFromCharacter(character)
	if not player or not player:GetAttribute("DataLoaded") then
		return
	end

	local index = part:GetAttribute("Index")
	local current = player:GetAttribute("Checkpoint") or 0
	-- Hanya terima Pos berikutnya agar urutan pendakian tidak bisa dilompati
	if index ~= current + 1 then
		return
	end

	setCheckpoint(player, index)
	if index >= Config.STAGES then
		reachSummit(player)
	else
		announceEvent:FireClient(player, "Sampai di " .. Config.checkpointName(index) .. "! Lanjut terus, Kak!")
	end
end

for _, part in pairs(checkpointParts) do
	part.Touched:Connect(function(hit)
		onCheckpointTouched(part, hit)
	end)
end

local function placeAtCheckpoint(player, character)
	local index = player:GetAttribute("Checkpoint") or 0
	local part = checkpointParts[index] or checkpointParts[0]
	if not part then
		return
	end
	local root = character:WaitForChild("HumanoidRootPart", 10)
	if root then
		task.wait() -- tunggu karakter selesai dimuat sebelum dipindah
		character:PivotTo(CFrame.new(part.Position + Vector3.new(0, 5, 0)) * part.CFrame.Rotation)
	end
end

local function onPlayerAdded(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local posValue = Instance.new("StringValue")
	posValue.Name = "Posisi"
	posValue.Value = "Basecamp"
	posValue.Parent = leaderstats
	local summitValue = Instance.new("IntValue")
	summitValue.Name = "Summit"
	summitValue.Parent = leaderstats
	leaderstats.Parent = player

	local data = loadData(player)
	if not player.Parent then
		return -- pemain sudah keluar saat data dimuat
	end

	local checkpoint = math.clamp(tonumber(data.checkpoint) or 0, 0, Config.STAGES)
	-- Pemain yang terakhir di Puncak mulai lagi dari Basecamp
	if checkpoint >= Config.STAGES then
		checkpoint = 0
	end
	player:SetAttribute("Summits", tonumber(data.summits) or 0)
	if data.bestTime then
		player:SetAttribute("BestTime", data.bestTime)
	end
	player:SetAttribute("ClimbStart", now())
	summitValue.Value = player:GetAttribute("Summits")
	setCheckpoint(player, checkpoint)
	player:SetAttribute("DataLoaded", true)

	player.CharacterAdded:Connect(function(character)
		placeAtCheckpoint(player, character)
	end)
	if player.Character then
		placeAtCheckpoint(player, player.Character)
	end

	announceEvent:FireClient(player, Config.WELCOME_TEXT)
end

basecampEvent.OnServerEvent:Connect(function(player)
	local t = os.clock()
	if lastBasecampRequest[player] and t - lastBasecampRequest[player] < 3 then
		return
	end
	lastBasecampRequest[player] = t
	if not player:GetAttribute("DataLoaded") then
		return
	end
	setCheckpoint(player, 0)
	player:SetAttribute("ClimbStart", now())
	player:LoadCharacter()
end)

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	lastBasecampRequest[player] = nil
	saveData(player)
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		task.spawn(saveData, player)
	end
	task.wait(3)
end)
