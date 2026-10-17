-- Membangun peta gunung secara otomatis:
-- tumpukan silinder batu yang makin mengecil ke atas, dengan jalur pijakan
-- melingkar di sisi luar. Bagian atas tiap silinder menjadi teras tempat Pos.
-- Jatuh dari jalur = mendarat di teras/Pos sebelumnya.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local Config = require(ReplicatedStorage:WaitForChild("SummitShared"):WaitForChild("Config"))

local MapBuilder = {}

local MAP_NAME = "JOTISummitMap"

local function makePart(props, parent)
	local part = Instance.new("Part")
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in pairs(props) do
		part[key] = value
	end
	part.Parent = parent
	return part
end

-- Silinder tegak (Part.Shape Cylinder berporos sumbu X, jadi diputar 90 derajat)
local function makeVerticalCylinder(name, radius, height, center, color, material, parent)
	return makePart({
		Name = name,
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(height, radius * 2, radius * 2),
		CFrame = CFrame.new(center) * CFrame.Angles(0, 0, math.rad(90)),
		Color = color,
		Material = material,
	}, parent)
end

local function polar(radius, angle, y)
	return Vector3.new(radius * math.cos(angle), y, radius * math.sin(angle))
end

-- CFrame yang menghadap ke pusat gunung
local function facingCenter(position)
	return CFrame.lookAt(position, Vector3.new(0, position.Y, 0))
end

local function addLabel(part, text, color, maxDistance)
	local gui = Instance.new("BillboardGui")
	gui.Name = "Label"
	gui.Size = UDim2.fromOffset(220, 50)
	gui.StudsOffset = Vector3.new(0, 6, 0)
	gui.AlwaysOnTop = false
	gui.MaxDistance = maxDistance or 150
	gui.Parent = part

	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextColor3 = color or Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.3
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.Parent = gui
	return gui
end

local function addSurfaceText(part, face, lines)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 40
	gui.Parent = part

	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Vertical
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.VerticalAlignment = Enum.VerticalAlignment.Center
	layout.Padding = UDim.new(0.02, 0)
	layout.Parent = gui

	for i, line in ipairs(lines) do
		local label = Instance.new("TextLabel")
		label.LayoutOrder = i
		label.Size = UDim2.fromScale(0.95, line.scale or 0.2)
		label.BackgroundTransparency = 1
		label.Text = line.text
		label.TextColor3 = line.color or Color3.new(1, 1, 1)
		label.Font = line.font or Enum.Font.GothamBold
		label.TextScaled = true
		label.Parent = gui
	end
	return gui
end

local function makeTree(position, rng, parent)
	local model = Instance.new("Model")
	model.Name = "Pohon"
	local trunkHeight = rng:NextNumber(8, 14)
	makePart({
		Name = "Batang",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(trunkHeight, 2, 2),
		CFrame = CFrame.new(position + Vector3.new(0, trunkHeight / 2, 0)) * CFrame.Angles(0, 0, math.rad(90)),
		Color = Config.COLORS.ScoutBrown,
		Material = Enum.Material.Wood,
	}, model)
	local leafSize = rng:NextNumber(9, 14)
	makePart({
		Name = "Daun",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(leafSize, leafSize, leafSize),
		CFrame = CFrame.new(position + Vector3.new(0, trunkHeight + leafSize * 0.3, 0)),
		Color = Color3.fromRGB(46, 110, 50),
		Material = Enum.Material.Grass,
	}, model)
	model.Parent = parent
end

local function makeFlag(position, parent)
	local model = Instance.new("Model")
	model.Name = "BenderaMerahPutih"
	local poleHeight = 24
	makePart({
		Name = "Tiang",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(poleHeight, 0.6, 0.6),
		CFrame = CFrame.new(position + Vector3.new(0, poleHeight / 2, 0)) * CFrame.Angles(0, 0, math.rad(90)),
		Color = Color3.fromRGB(220, 220, 220),
		Material = Enum.Material.Metal,
	}, model)
	makePart({
		Name = "Merah",
		Size = Vector3.new(9, 3, 0.2),
		CFrame = CFrame.new(position + Vector3.new(4.8, poleHeight - 1.5, 0)),
		Color = Config.COLORS.Red,
		Material = Enum.Material.Fabric,
		CanCollide = false,
	}, model)
	makePart({
		Name = "Putih",
		Size = Vector3.new(9, 3, 0.2),
		CFrame = CFrame.new(position + Vector3.new(4.8, poleHeight - 4.5, 0)),
		Color = Config.COLORS.White,
		Material = Enum.Material.Fabric,
		CanCollide = false,
	}, model)
	model.Parent = parent
	return model
end

local function sectionRadius(stage)
	return Config.BASE_RADIUS - Config.RADIUS_STEP * (stage - 1)
end

function MapBuilder.getOrBuild()
	local existing = workspace:FindFirstChild(MAP_NAME)
	if existing then
		return existing
	end
	return MapBuilder.build()
end

function MapBuilder.build()
	local map = Instance.new("Folder")
	map.Name = MAP_NAME

	local mountain = Instance.new("Folder")
	mountain.Name = "Gunung"
	mountain.Parent = map

	local path = Instance.new("Folder")
	path.Name = "Jalur"
	path.Parent = map

	local checkpoints = Instance.new("Folder")
	checkpoints.Name = "Checkpoints"
	checkpoints.Parent = map

	local decor = Instance.new("Folder")
	decor.Name = "Dekorasi"
	decor.Parent = map

	local stages = Config.STAGES
	local stageHeight = Config.STAGE_HEIGHT
	local size = Config.PLATFORM_SIZE
	local perStage = Config.PLATFORMS_PER_STAGE
	local summitY = stages * stageHeight

	assert(sectionRadius(stages) > size * 2, "Config: BASE_RADIUS terlalu kecil untuk jumlah STAGES/RADIUS_STEP ini")

	-- Tanah
	makePart({
		Name = "Tanah",
		Size = Vector3.new(900, 4, 900),
		CFrame = CFrame.new(0, -2, 0),
		Color = Config.COLORS.Grass,
		Material = Enum.Material.Grass,
	}, map)

	-- Badan gunung: satu silinder per tahap
	for stage = 1, stages do
		local radius = sectionRadius(stage)
		local bottom = (stage - 1) * stageHeight
		local t = (stage - 1) / math.max(1, stages - 1)
		local color = Config.COLORS.Rock:Lerp(Config.COLORS.RockHigh, t)
		local material = stage == stages and Enum.Material.Snow or Enum.Material.Rock
		if stage == stages then
			color = Config.COLORS.Summit
		end
		makeVerticalCylinder(
			"Tahap" .. stage,
			radius,
			stageHeight,
			Vector3.new(0, bottom + stageHeight / 2, 0),
			color,
			material,
			mountain
		)
	end

	-- Basecamp (checkpoint 0)
	local basecampPos = polar(Config.BASE_RADIUS + 30, -0.12, 0)
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Checkpoint_0"
	spawn.Anchored = true
	spawn.Size = Vector3.new(14, 1, 14)
	spawn.CFrame = facingCenter(basecampPos + Vector3.new(0, 0.5, 0))
	spawn.Color = Config.COLORS.Checkpoint
	spawn.Material = Enum.Material.SmoothPlastic
	spawn.Duration = 0
	spawn.Neutral = true
	spawn:SetAttribute("Index", 0)
	spawn.Parent = checkpoints
	addLabel(spawn, "BASECAMP", Config.COLORS.Checkpoint, 200)

	-- Papan selamat datang
	local signPos = basecampPos + (basecampPos.Unit * 14) + Vector3.new(0, 8, 0)
	local sign = makePart({
		Name = "PapanSelamatDatang",
		Size = Vector3.new(24, 14, 1),
		CFrame = facingCenter(signPos),
		Color = Config.COLORS.ScoutBrown,
		Material = Enum.Material.Wood,
	}, decor)
	addSurfaceText(sign, Enum.NormalId.Front, {
		{ text = "SUMMIT BARENG", scale = 0.22, font = Enum.Font.GothamBlack, color = Config.COLORS.Checkpoint },
		{ text = Config.EVENT_NAME, scale = 0.28, font = Enum.Font.GothamBlack },
		{ text = Config.ORGANIZER, scale = 0.15 },
		{ text = Config.MOUNTAIN_NAME, scale = 0.12, color = Color3.fromRGB(220, 220, 220) },
	})

	-- Papan "Buku Puncak" (diisi oleh server)
	local boardPos = polar(Config.BASE_RADIUS + 34, -0.32, 9)
	local board = makePart({
		Name = "BukuPuncak",
		Size = Vector3.new(18, 16, 1),
		CFrame = facingCenter(boardPos),
		Color = Color3.fromRGB(30, 40, 30),
		Material = Enum.Material.SmoothPlastic,
	}, map)
	local boardGui = Instance.new("SurfaceGui")
	boardGui.Name = "BoardGui"
	boardGui.Face = Enum.NormalId.Front
	boardGui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	boardGui.PixelsPerStud = 40
	boardGui.Parent = board
	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.Size = UDim2.fromScale(1, 0.14)
	title.BackgroundTransparency = 1
	title.Text = "BUKU PUNCAK"
	title.TextColor3 = Config.COLORS.Checkpoint
	title.Font = Enum.Font.GothamBlack
	title.TextScaled = true
	title.Parent = boardGui
	local list = Instance.new("TextLabel")
	list.Name = "List"
	list.Position = UDim2.fromScale(0.04, 0.16)
	list.Size = UDim2.fromScale(0.92, 0.82)
	list.BackgroundTransparency = 1
	list.Text = "Belum ada yang sampai puncak.\nAyo jadi yang pertama!"
	list.TextColor3 = Color3.new(1, 1, 1)
	list.Font = Enum.Font.Gotham
	list.TextSize = 34
	list.TextWrapped = true
	list.TextXAlignment = Enum.TextXAlignment.Left
	list.TextYAlignment = Enum.TextYAlignment.Top
	list.Parent = boardGui

	-- Jalur pijakan + Pos
	local angle = 0
	for stage = 1, stages do
		local radius = sectionRadius(stage)
		local pathRadius = radius + size / 2 -- pijakan menempel di dinding gunung
		local step = Config.PLATFORM_SPACING / pathRadius
		local bottom = (stage - 1) * stageHeight
		local rise = stageHeight / perStage

		for i = 1, perStage do
			angle = angle + step
			local top = bottom + rise * i
			local pos = polar(pathRadius, angle, top - 0.5)
			makePart({
				Name = string.format("Pijakan_%d_%d", stage, i),
				Size = Vector3.new(size, 1, size),
				CFrame = facingCenter(pos),
				Color = Config.COLORS.Platform,
				Material = Enum.Material.WoodPlanks,
			}, path)
		end

		-- Checkpoint di teras / puncak
		local top = stage * stageHeight
		local cpPos
		if stage == stages then
			cpPos = Vector3.new(0, top + 0.5, 0)
		else
			cpPos = polar(radius - 5, angle, top + 0.5)
		end
		local cp = makePart({
			Name = "Checkpoint_" .. stage,
			Size = stage == stages and Vector3.new(14, 1, 14) or Vector3.new(8, 1, 8),
			CFrame = facingCenter(cpPos),
			Color = Config.COLORS.Checkpoint,
			Material = Enum.Material.Neon,
		}, checkpoints)
		cp:SetAttribute("Index", stage)
		addLabel(cp, string.upper(Config.checkpointName(stage)), Config.COLORS.Checkpoint, stage == stages and 400 or 150)
	end

	-- Puncak: bendera dan papan
	makeFlag(Vector3.new(0, summitY + 1, -9), decor)
	local summitSign = makePart({
		Name = "PapanPuncak",
		Size = Vector3.new(16, 8, 1),
		CFrame = CFrame.new(0, summitY + 4, 10) * CFrame.Angles(0, math.rad(180), 0),
		Color = Config.COLORS.ScoutBrown,
		Material = Enum.Material.Wood,
	}, decor)
	addSurfaceText(summitSign, Enum.NormalId.Front, {
		{ text = "PUNCAK", scale = 0.3, font = Enum.Font.GothamBlack, color = Config.COLORS.Checkpoint },
		{ text = Config.MOUNTAIN_NAME, scale = 0.22 },
		{ text = Config.EVENT_NAME .. " - " .. Config.ORGANIZER, scale = 0.16 },
	})
	addSurfaceText(summitSign, Enum.NormalId.Back, {
		{ text = "PUNCAK", scale = 0.3, font = Enum.Font.GothamBlack, color = Config.COLORS.Checkpoint },
		{ text = Config.MOUNTAIN_NAME, scale = 0.22 },
		{ text = Config.EVENT_NAME .. " - " .. Config.ORGANIZER, scale = 0.16 },
	})

	-- Pepohonan di sekitar kaki gunung (hindari area basecamp)
	local rng = Random.new(2026)
	local planted = 0
	while planted < 60 do
		local a = rng:NextNumber(0, math.pi * 2)
		local nearBasecamp = math.abs(math.atan2(math.sin(a + 0.2), math.cos(a + 0.2))) < 0.35
		if not nearBasecamp then
			local r = rng:NextNumber(Config.BASE_RADIUS + 25, 430)
			makeTree(polar(r, a, 0), rng, decor)
			planted = planted + 1
		end
	end

	-- Suasana siang yang cerah
	Lighting.ClockTime = 14
	Lighting.Brightness = 2

	map.Parent = workspace
	return map
end

return MapBuilder
