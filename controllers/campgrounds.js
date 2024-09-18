const { fileLoader } = require('ejs');
const Campground = require('../models/campground');
const {cloudinary}=require('../cloudinary');
const maptilerClient = require("@maptiler/client");
maptilerClient.config.apiKey = process.env.MAPTILER_API_KEY;

module.exports.index=async (req, res) => {
    const campgrounds = await Campground.find({});
    res.render('campgrounds/index', { campgrounds });
};

module.exports.renderNewForm =(req, res) => {
    res.render('campgrounds/new');
};

module.exports.createCampground=async (req, res) => {
    const geoData = await maptilerClient.geocoding.forward(req.body.campground.location, { limit: 1 });
    const campground = new Campground(req.body.campground);
    campground.geometry = geoData.features[0].geometry;
    campground.images=req.files.map(f=>({url:f.path,filename:f.filename}));
    campground.author = req.user._id;  // Assign the user as the author
    await campground.save();
    req.flash('success', 'Successfully made a new campground');
    console.log(campground);
    res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.showCampground=async (req, res) => {
    const campground = await Campground.findById(req.params.id).populate({path:'reviews',populate:{path:'author'}}).populate('author');
    if (!campground) {
        req.flash('error', 'Cannot find the campground');
        return res.redirect('/campgrounds');
    }
    console.log(campground);
    res.render('campgrounds/show', { campground });
};

module.exports.renderEditForm=async (req, res) => {
    const campground = await Campground.findById(req.params.id);
    if (!campground) {
        req.flash('error', 'Cannot find Campground');
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/edit', { campground });
};

module.exports.updateCampground=async (req, res) => {
    const { id } = req.params;
    console.log(req.body);
    const campground = await Campground.findByIdAndUpdate(id, { ...req.body.campground }, { new: true });
    const geoData = await maptilerClient.geocoding.forward(req.body.campground.location, { limit: 1 });
    campground.geometry = geoData.features[0].geometry;
    const imgs=req.files.map(f=>({url:f.path,filename:f.filename}));
    campground.images.push(...imgs);
    await campground.save();
    if(req.body.deleteImages){
        for(let filename of req.body.deleteImages){
            await cloudinary.uploader.destroy(filename);
        }
        await campground.updateOne({$pull:{images:{filename:{$in:req.body.deleteImages}}}})
    console.log(campground)
    }
    req.flash('success', 'Successfully updated the campground');
    res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.deleteCampground = async (req, res) => {
    const { id } = req.params;

    const campground = await Campground.findById(id);
    const images = campground.images.map(img => img.filename);

    for (const filename of images) {
        await cloudinary.uploader.destroy(filename);
    }

    await Campground.findByIdAndDelete(id);

    req.flash('success', 'Successfully deleted the campground');
    res.redirect('/campgrounds');
};